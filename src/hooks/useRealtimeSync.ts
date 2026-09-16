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
  const pendingNotesRef = useRef<Map<string, Note>>(new Map());
  const connectWsRef = useRef<(() => void) | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);

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

  // Fetch from REST API (initial load + polling fallback)
  const fetchNotesRest = useCallback(async (rId: string) => {
    try {
      const res = await fetch(`/api/rooms/${rId}/notes`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notes) && data.notes.length > 0) {
          setNotes((currentNotes) => {
            // Check if there are real changes
            if (currentNotes.length !== data.notes.length) {
              return data.notes;
            }
            let hasDifference = false;
            for (const sNote of data.notes) {
              const local = currentNotes.find((n) => n.id === sNote.id);
              if (
                !local ||
                (sNote.updatedAt && local.updatedAt && sNote.updatedAt > local.updatedAt) ||
                sNote.content !== local.content ||
                sNote.title !== local.title
              ) {
                hasDifference = true;
                break;
              }
            }
            if (!hasDifference) return currentNotes;
            return data.notes;
          });

          setActiveNoteId((current) => {
            if (current && data.notes.some((n: Note) => n.id === current)) {
              return current;
            }
            return data.notes.length > 0 ? data.notes[0].id : "";
          });
          setSyncState("synced");
          setLastSavedAt(Date.now());
        }
      }
    } catch (err) {
      console.warn("Could not fetch notes from REST API fallback:", err);
    }
  }, []);

  // Instant local multi-tab / multi-screen sync via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(`bloco_room_${roomId}`);
      bcRef.current = channel;

      channel.onmessage = (event) => {
        const data = event.data;
        if (!data) return;

        if (data.type === "note_update" && data.note) {
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
        }
      };

      return () => {
        channel.close();
        bcRef.current = null;
      };
    }
  }, [roomId]);

  // Periodic polling & window visibility / focus recovery (for phones waking up, tab switching, etc.)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchNotesRest(roomId);
      }
    }, 2500);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        fetchNotesRest(roomId);
        if (
          !wsRef.current ||
          wsRef.current.readyState === WebSocket.CLOSED ||
          wsRef.current.readyState === WebSocket.CLOSING
        ) {
          connectWsRef.current?.();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [roomId, fetchNotesRest]);

  // Initialize and handle WebSocket
  useEffect(() => {
    let isMounted = true;
    setSyncState("connecting");

    // Immediate initial load
    fetchNotesRest(roomId);

    // Build WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let reconnectTimer: NodeJS.Timeout | null = null;
    let pingInterval: NodeJS.Timeout | null = null;

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

          // Start client ping keepalive every 20s
          if (pingInterval) clearInterval(pingInterval);
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ type: "ping" }));
              } catch {
                // ignore
              }
            }
          }, 20000);
        };

        ws.onmessage = (evt) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(evt.data);

            if (data.type === "pong") {
              return;
            }

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
          if (pingInterval) clearInterval(pingInterval);
          if (isMounted) {
            reconnectTimer = setTimeout(() => {
              connectWs();
            }, 2000);
          }
        };
      } catch (err) {
        console.error("WS connection failure:", err);
        setIsConnected(false);
        setSyncState("offline");
      }
    }

    connectWsRef.current = connectWs;
    connectWs();

    return () => {
      isMounted = false;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId, deviceId, deviceName, deviceColor, fetchNotesRest]);

  // Active note helper
  const activeNote = notes.find((n) => n.id === activeNoteId) || (notes.length > 0 ? notes[0] : null);

  // Update active note content or title with instant local broadcast and debounced network send
  const updateActiveNote = useCallback(
    (fields: Partial<Note>) => {
      if (!activeNoteIdRef.current) return;
      const targetId = activeNoteIdRef.current;

      setSyncState("saving");

      const existingIndex = notesRef.current.findIndex((n) => n.id === targetId);
      if (existingIndex < 0) return;

      const current = notesRef.current[existingIndex];
      const updated: Note = {
        ...current,
        ...fields,
        updatedAt: Date.now(),
        version: (current.version || 1) + 1,
      };

      pendingNotesRef.current.set(targetId, updated);

      // Immediately update local state
      setNotes((prev) => {
        const index = prev.findIndex((n) => n.id === targetId);
        if (index < 0) return prev;
        const copy = [...prev];
        copy[index] = updated;
        return copy;
      });

      // Instantly broadcast to other tabs/screens on the same browser
      if (bcRef.current) {
        try {
          bcRef.current.postMessage({
            type: "note_update",
            roomId,
            note: updated,
          });
        } catch {
          // ignore
        }
      }

      // Broadcast typing indicator to remote devices
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

      // Fast debounced send (150ms) to cloud and broadcast to other devices
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = setTimeout(() => {
        const noteToSend = pendingNotesRef.current.get(targetId) || updated;
        if (!noteToSend) return;

        // WebSocket broadcast to other devices
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const updateMsg: SyncMessage = {
            type: "note_update",
            roomId,
            deviceId,
            deviceName,
            note: noteToSend,
            timestamp: Date.now(),
          };
          wsRef.current.send(JSON.stringify(updateMsg));
        }

        // REST fallback persist with device ID header
        fetch(`/api/rooms/${roomId}/notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-device-id": deviceId,
          },
          body: JSON.stringify(noteToSend),
        })
          .then(() => {
            setSyncState("synced");
            setLastSavedAt(Date.now());
          })
          .catch((err) => {
            console.warn("Rest save error:", err);
            setSyncState("synced");
          });
      }, 150);

      // Stop typing indicator after pause
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

    // Instantly notify other tabs/screens on the same browser
    if (bcRef.current) {
      try {
        bcRef.current.postMessage({
          type: "note_update",
          roomId,
          note: newNote,
        });
      } catch {
        // ignore
      }
    }

    // Broadcast creation via WebSocket
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
      headers: {
        "Content-Type": "application/json",
        "x-device-id": deviceId,
      },
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

      // Broadcast delete to other tabs/screens on the same browser
      if (bcRef.current) {
        try {
          bcRef.current.postMessage({
            type: "note_delete",
            roomId,
            noteId: id,
          });
        } catch {
          // ignore
        }
      }

      // Broadcast delete via WebSocket
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
      fetch(`/api/rooms/${roomId}/notes/${id}`, {
        method: "DELETE",
        headers: { "x-device-id": deviceId },
      });
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

      // Broadcast to local tabs
      if (bcRef.current) {
        try {
          bcRef.current.postMessage({
            type: "note_update",
            roomId,
            note: cloned,
          });
        } catch {
          // ignore
        }
      }

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
        headers: {
          "Content-Type": "application/json",
          "x-device-id": deviceId,
        },
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
