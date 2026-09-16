import { useState, useEffect, useRef, useCallback } from "react";
import { Note, ConnectedDevice, SyncMessage } from "../types";

function getDeviceId(): string {
  let id = localStorage.getItem("bloco_device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    localStorage.setItem("bloco_device_id", id);
  }
  return id;
}

function getDeviceName(): string {
  const saved = localStorage.getItem("bloco_device_name");
  if (saved) return saved;

  const ua = navigator.userAgent;
  let name = "Computador";
  if (/Android/i.test(ua)) name = "Celular Android";
  else if (/iPhone/i.test(ua)) name = "iPhone";
  else if (/iPad/i.test(ua)) name = "iPad";
  else if (/Macintosh/i.test(ua)) name = "Mac";
  else if (/Windows/i.test(ua)) name = "Windows PC";
  else if (/Linux/i.test(ua)) name = "Linux";

  localStorage.setItem("bloco_device_name", name);
  return name;
}

const DEVICE_COLORS = [
  "#2563eb", // blue
  "#16a34a", // green
  "#d97706", // amber
  "#9333ea", // purple
  "#e11d48", // rose
  "#0d9488", // teal
];

function getDeviceColor(): string {
  let color = localStorage.getItem("bloco_device_color");
  if (!color) {
    color = DEVICE_COLORS[Math.floor(Math.random() * DEVICE_COLORS.length)];
    localStorage.setItem("bloco_device_color", color);
  }
  return color;
}

export interface UseRealtimeSyncReturn {
  notes: Note[];
  activeNote: Note | null;
  activeNoteId: string;
  roomId: string;
  setRoomId: (id: string) => void;
  setActiveNoteId: (id: string) => void;
  updateActiveNote: (fields: Partial<Note>) => void;
  createNote: () => Note;
  deleteNote: (id: string) => void;
  duplicateNote: (note: Note) => void;
  devices: ConnectedDevice[];
  isConnected: boolean;
  syncState: "synced" | "saving" | "offline" | "connecting";
  lastSavedAt: number | null;
  remoteTypingDevice: string | null;
  deviceName: string;
  setDeviceName: (name: string) => void;
  deviceId: string;
  deviceColor: string;
}

export function useRealtimeSync(initialRoomId?: string): UseRealtimeSyncReturn {
  const [roomId, setRoomState] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get("room");
    if (fromUrl) return fromUrl;
    return initialRoomId || localStorage.getItem("bloco_current_room") || "meu-bloco";
  });

  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>("");
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<"synced" | "saving" | "offline" | "connecting">("connecting");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [remoteTypingDevice, setRemoteTypingDevice] = useState<string | null>(null);

  const [deviceId] = useState<string>(getDeviceId);
  const [deviceName, setDeviceNameState] = useState<string>(getDeviceName);
  const [deviceColor] = useState<string>(getDeviceColor);

  const wsRef = useRef<WebSocket | null>(null);
  const notesRef = useRef<Note[]>(notes);
  notesRef.current = notes;

  const activeNoteIdRef = useRef<string>(activeNoteId);
  activeNoteIdRef.current = activeNoteId;

  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const remoteTypingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const setDeviceName = useCallback((name: string) => {
    setDeviceNameState(name);
    localStorage.setItem("bloco_device_name", name);
  }, []);

  const setRoomId = useCallback((newRoom: string) => {
    const cleanRoom = newRoom.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-") || "meu-bloco";
    setRoomState(cleanRoom);
    localStorage.setItem("bloco_current_room", cleanRoom);

    // Update URL query string without reloading
    const url = new URL(window.location.href);
    url.searchParams.set("room", cleanRoom);
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Fetch fallback from REST API
  const fetchNotesRest = useCallback(async (rId: string) => {
    try {
      const res = await fetch(`/api/rooms/${rId}/notes`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notes) && data.notes.length > 0) {
          setNotes(data.notes);
          setActiveNoteId((current) => {
            if (current && data.notes.some((n: Note) => n.id === current)) {
              return current;
            }
            return data.notes[0].id;
          });
          setSyncState("synced");
          setLastSavedAt(Date.now());
        }
      }
    } catch (err) {
      console.warn("Could not fetch notes from REST API fallback:", err);
    }
  }, []);

  // Initialize and handle WebSocket
  useEffect(() => {
    let isMounted = true;
    setSyncState("connecting");

    // Try REST first as immediate load
    fetchNotesRest(roomId);

    // Build WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let reconnectTimer: NodeJS.Timeout | null = null;

    function connectWs() {
      if (!isMounted) return;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
          setSyncState("synced");

          // Send join message
          const joinMsg: SyncMessage = {
            type: "join",
            roomId,
            deviceId,
            deviceName,
            deviceColor,
            timestamp: Date.now(),
          };
          ws.send(JSON.stringify(joinMsg));
        };

        ws.onmessage = (evt) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(evt.data);

            if (data.type === "init") {
              if (Array.isArray(data.notes) && data.notes.length > 0) {
                setNotes(data.notes);
                setActiveNoteId((curr) => {
                  if (curr && data.notes.some((n: Note) => n.id === curr)) return curr;
                  return data.notes[0].id;
                });
              }
              setSyncState("synced");
              setLastSavedAt(Date.now());
            } else if (data.type === "note_update" && data.note) {
              const updatedNote: Note = data.note;
              setNotes((prev) => {
                const index = prev.findIndex((n) => n.id === updatedNote.id);
                if (index >= 0) {
                  const copy = [...prev];
                  copy[index] = updatedNote;
                  return copy;
                }
                return [updatedNote, ...prev];
              });
              setSyncState("synced");
              setLastSavedAt(Date.now());
            } else if (data.type === "note_delete" && data.noteId) {
              setNotes((prev) => {
                const nextNotes = prev.filter((n) => n.id !== data.noteId);
                if (activeNoteIdRef.current === data.noteId) {
                  setActiveNoteId(nextNotes.length > 0 ? nextNotes[0].id : "");
                }
                return nextNotes;
              });
            } else if (data.type === "presence" && Array.isArray(data.devices)) {
              setDevices(
                data.devices.map((d: ConnectedDevice) => ({
                  ...d,
                  isSelf: d.id === deviceId,
                }))
              );
            } else if (data.type === "typing") {
              if (data.deviceId !== deviceId && data.isTyping) {
                setRemoteTypingDevice(data.deviceName || "Outro dispositivo");
                if (remoteTypingTimerRef.current) clearTimeout(remoteTypingTimerRef.current);
                remoteTypingTimerRef.current = setTimeout(() => {
                  setRemoteTypingDevice(null);
                }, 2000);
              }
            }
          } catch (err) {
            console.error("Error parsing WS message:", err);
          }
        };

        ws.onerror = () => {
          setIsConnected(false);
          setSyncState("offline");
        };

        ws.onclose = () => {
          setIsConnected(false);
          setSyncState("offline");
          if (isMounted) {
            reconnectTimer = setTimeout(() => {
              connectWs();
            }, 3000);
          }
        };
      } catch (err) {
        console.error("WS connection failure:", err);
        setIsConnected(false);
        setSyncState("offline");
      }
    }

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId, deviceId, deviceName, deviceColor, fetchNotesRest]);

  // Active note helper
  const activeNote = notes.find((n) => n.id === activeNoteId) || (notes.length > 0 ? notes[0] : null);

  // Update active note content or title
  const updateActiveNote = useCallback(
    (fields: Partial<Note>) => {
      if (!activeNoteIdRef.current) return;
      const targetId = activeNoteIdRef.current;

      setSyncState("saving");

      let updatedNoteObj: Note | null = null;

      setNotes((prev) => {
        const index = prev.findIndex((n) => n.id === targetId);
        if (index < 0) return prev;
        const current = prev[index];
        const updated: Note = {
          ...current,
          ...fields,
          updatedAt: Date.now(),
          version: (current.version || 1) + 1,
        };
        updatedNoteObj = updated;
        const copy = [...prev];
        copy[index] = updated;
        return copy;
      });

      // Broadcast typing indicator
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const typingMsg: SyncMessage = {
          type: "typing",
          roomId,
          deviceId,
          deviceName,
          noteId: targetId,
          isTyping: true,
          timestamp: Date.now(),
        };
        wsRef.current.send(JSON.stringify(typingMsg));
      }

      // Debounced send to cloud and broadcast to other devices
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = setTimeout(() => {
        if (!updatedNoteObj) return;

        // WebSocket broadcast
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const updateMsg: SyncMessage = {
            type: "note_update",
            roomId,
            deviceId,
            deviceName,
            note: updatedNoteObj,
            timestamp: Date.now(),
          };
          wsRef.current.send(JSON.stringify(updateMsg));
        }

        // REST fallback persist
        fetch(`/api/rooms/${roomId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedNoteObj),
        })
          .then(() => {
            setSyncState("synced");
            setLastSavedAt(Date.now());
          })
          .catch((err) => {
            console.warn("Rest save error:", err);
            setSyncState("synced"); // Still locally and WS saved
          });
      }, 350);

      // Stop typing indicator after short pause
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "typing",
              roomId,
              deviceId,
              deviceName,
              noteId: targetId,
              isTyping: false,
              timestamp: Date.now(),
            })
          );
        }
      }, 1200);
    },
    [roomId, deviceId, deviceName]
  );

  // Create new note
  const createNote = useCallback(() => {
    const newNote: Note = {
      id: "note_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      title: "Nova Anotação",
      content: "",
      tags: [],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    setSyncState("saving");

    // Broadcast creation
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "note_update",
          roomId,
          deviceId,
          deviceName,
          note: newNote,
          timestamp: Date.now(),
        })
      );
    }

    // Persist via REST
    fetch(`/api/rooms/${roomId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newNote),
    }).then(() => {
      setSyncState("synced");
      setLastSavedAt(Date.now());
    });

    return newNote;
  }, [roomId, deviceId, deviceName]);

  // Delete note
  const deleteNote = useCallback(
    (id: string) => {
      setNotes((prev) => {
        const nextNotes = prev.filter((n) => n.id !== id);
        if (activeNoteIdRef.current === id) {
          setActiveNoteId(nextNotes.length > 0 ? nextNotes[0].id : "");
        }
        return nextNotes;
      });

      // Broadcast delete
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "note_delete",
            roomId,
            deviceId,
            noteId: id,
            timestamp: Date.now(),
          })
        );
      }

      // Call REST
      fetch(`/api/rooms/${roomId}/notes/${id}`, { method: "DELETE" });
    },
    [roomId, deviceId]
  );

  // Duplicate note
  const duplicateNote = useCallback(
    (noteToDuplicate: Note) => {
      const cloned: Note = {
        ...noteToDuplicate,
        id: "note_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        title: `${noteToDuplicate.title} (Cópia)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      setNotes((prev) => [cloned, ...prev]);
      setActiveNoteId(cloned.id);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "note_update",
            roomId,
            deviceId,
            deviceName,
            note: cloned,
            timestamp: Date.now(),
          })
        );
      }

      fetch(`/api/rooms/${roomId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cloned),
      });
    },
    [roomId, deviceId, deviceName]
  );

  return {
    notes,
    activeNote,
    activeNoteId,
    roomId,
    setRoomId,
    setActiveNoteId,
    updateActiveNote,
    createNote,
    deleteNote,
    duplicateNote,
    devices,
    isConnected,
    syncState,
    lastSavedAt,
    remoteTypingDevice,
    deviceName,
    setDeviceName,
    deviceId,
    deviceColor,
  };
}
