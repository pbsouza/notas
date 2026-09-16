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

export const DEFAULT_WELCOME_NOTE: Note = {
  id: "welcome-note",
  title: "Bem-vindo ao Bloco de Notas Nuvem",
  content: `Bem-vindo ao seu Bloco de Notas com Sincronização em Tempo Real e Nuvem! 🚀

Recursos principais:
• ☁️ Salvamento automático contínuo na nuvem e no dispositivo (offline-first)
• 🔄 Sincronização em tempo real entre celulares, tablets e computadores
• 💾 Exportação em múltiplos formatos: PDF, DOC, DOCX, TXT, TFT, BAT, HTML, MD, JSON, etc.
• 📱 Conexão instantânea por Código de Sala ou QR Code
• 🎨 Fontes ajustáveis (Mono, Sans, Serif) e temas personalizáveis
• 🔍 Ferramenta de Localizar e Substituir (Ctrl+F)
• 📋 Contagem ao vivo de palavras, caracteres, linhas e tempo de leitura

Para testar a sincronização em tempo real:
1. Abra esta mesma página em outro aparelho (celular/tablet) ou outra aba.
2. Digite aqui e veja o texto se atualizar instantaneamente!`,
  tags: ["Boas-vindas", "Tutorial"],
  pinned: true,
  createdAt: 1726000000000,
  updatedAt: 1726000000000,
  version: 1,
};

function loadLocalNotes(rId: string): Note[] {
  try {
    const raw = localStorage.getItem(`bloco_notes_${rId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    const backupRaw = localStorage.getItem("bloco_notes_backup");
    if (backupRaw) {
      const backupParsed = JSON.parse(backupRaw);
      if (Array.isArray(backupParsed) && backupParsed.length > 0) {
        return backupParsed;
      }
    }
  } catch (err) {
    console.warn("Error reading local notes:", err);
  }
  return [DEFAULT_WELCOME_NOTE];
}

function saveLocalNotes(rId: string, notesList: Note[]) {
  try {
    localStorage.setItem(`bloco_notes_${rId}`, JSON.stringify(notesList));
    localStorage.setItem("bloco_notes_backup", JSON.stringify(notesList));
    localStorage.setItem(`bloco_notes_last_save_${rId}`, Date.now().toString());
  } catch (err) {
    console.warn("Error saving local notes:", err);
  }
}

function loadLocalActiveNoteId(rId: string, availableNotes: Note[]): string {
  try {
    const savedId = localStorage.getItem(`bloco_active_note_${rId}`);
    if (savedId && availableNotes.some((n) => n.id === savedId)) {
      return savedId;
    }
  } catch (err) {
    console.warn("Error reading active note id:", err);
  }
  return availableNotes.length > 0 ? availableNotes[0].id : "";
}

function saveLocalActiveNoteId(rId: string, noteId: string) {
  try {
    if (noteId) {
      localStorage.setItem(`bloco_active_note_${rId}`, noteId);
    }
  } catch (err) {
    // ignore
  }
}

function mergeNotes(localList: Note[], remoteList: Note[]): Note[] {
  if (!Array.isArray(remoteList) || remoteList.length === 0) {
    return localList;
  }
  const map = new Map<string, Note>();
  for (const rNote of remoteList) {
    map.set(rNote.id, rNote);
  }
  for (const lNote of localList) {
    const remote = map.get(lNote.id);
    if (!remote) {
      // Note was created locally while offline -> keep it!
      map.set(lNote.id, lNote);
    } else {
      // If local has newer timestamp, keep local so recent offline edits aren't lost
      if ((lNote.updatedAt || 0) > (remote.updatedAt || 0)) {
        map.set(lNote.id, lNote);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

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
  updateNoteById: (id: string, fields: Partial<Note>) => void;
  createNote: () => Note;
  deleteNote: (id: string) => void;
  duplicateNote: (note: Note) => void;
  forceSync: () => void;
  devices: ConnectedDevice[];
  isConnected: boolean;
  syncState: "synced" | "saving" | "offline" | "connecting";
  lastSavedAt: number | null;
  remoteTypingDevice: string | null;
  deviceName: string;
  setDeviceName: (name: string) => void;
  deviceId: string;
  deviceColor: string;
  serverUrl: string;
  setServerUrl: (url: string) => void;
  isStaticHost: boolean;
  replaceOrMergeNotes: (incomingNotes: Note[]) => void;
}

export function useRealtimeSync(initialRoomId?: string): UseRealtimeSyncReturn {
  const [roomId, setRoomState] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get("room");
    if (fromUrl) return fromUrl;
    return initialRoomId || localStorage.getItem("bloco_current_room") || "meu-bloco";
  });

  const [notes, setNotes] = useState<Note[]>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const rId = urlParams.get("room") || initialRoomId || localStorage.getItem("bloco_current_room") || "meu-bloco";
    return loadLocalNotes(rId);
  });

  const [activeNoteId, setActiveNoteIdState] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const rId = urlParams.get("room") || initialRoomId || localStorage.getItem("bloco_current_room") || "meu-bloco";
    const initialNotes = loadLocalNotes(rId);
    return loadLocalActiveNoteId(rId, initialNotes);
  });

  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<"synced" | "saving" | "offline" | "connecting">("connecting");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(() => {
    const rId = localStorage.getItem("bloco_current_room") || "meu-bloco";
    const saved = localStorage.getItem(`bloco_notes_last_save_${rId}`);
    return saved ? parseInt(saved, 10) : Date.now();
  });
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

  const isStaticHost = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
  const [serverUrl, setServerUrlState] = useState<string>(() => {
    return localStorage.getItem("bloco_server_url") || "";
  });

  const setServerUrl = useCallback((url: string) => {
    const clean = url.trim().replace(/\/+$/, "");
    setServerUrlState(clean);
    if (clean) {
      localStorage.setItem("bloco_server_url", clean);
    } else {
      localStorage.removeItem("bloco_server_url");
    }
  }, []);

  const getApiBase = useCallback((): string | null => {
    if (serverUrl) {
      return serverUrl.trim().replace(/\/+$/, "");
    }
    // GitHub Pages is static: no relative /api/ backend exists
    if (isStaticHost) {
      return null;
    }
    return "";
  }, [serverUrl, isStaticHost]);

  const getWsUrl = useCallback((): string | null => {
    if (serverUrl) {
      const clean = serverUrl.trim().replace(/\/+$/, "");
      const wsProto = clean.startsWith("https") ? "wss:" : "ws:";
      const cleanHost = clean.replace(/^https?:\/\//, "");
      return `${wsProto}//${cleanHost}/ws`;
    }
    // GitHub Pages is static: no WebSocket server exists on github.io
    if (isStaticHost) {
      return null;
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }, [serverUrl, isStaticHost]);

  const setDeviceName = useCallback((name: string) => {
    setDeviceNameState(name);
    localStorage.setItem("bloco_device_name", name);
  }, []);

  const setActiveNoteId = useCallback(
    (idOrUpdater: string | ((curr: string) => string)) => {
      setActiveNoteIdState((prev) => {
        const nextId = typeof idOrUpdater === "function" ? idOrUpdater(prev) : idOrUpdater;
        activeNoteIdRef.current = nextId;
        saveLocalActiveNoteId(roomId, nextId);
        return nextId;
      });
    },
    [roomId]
  );

  const setRoomId = useCallback((newRoom: string) => {
    const cleanRoom = newRoom.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-") || "meu-bloco";
    setRoomState(cleanRoom);
    localStorage.setItem("bloco_current_room", cleanRoom);

    // Update URL query string without reloading
    const url = new URL(window.location.href);
    url.searchParams.set("room", cleanRoom);
    window.history.replaceState({}, "", url.toString());

    // Immediately load local notes for this room so no blank screen
    const localNotes = loadLocalNotes(cleanRoom);
    setNotes(localNotes);
    const activeId = loadLocalActiveNoteId(cleanRoom, localNotes);
    setActiveNoteIdState(activeId);
    activeNoteIdRef.current = activeId;
  }, []);

  // Fetch from REST API (initial load + polling fallback)
  const fetchNotesRest = useCallback(
    async (rId: string) => {
      const apiBase = getApiBase();
      if (apiBase === null) {
        // Static host (e.g. GitHub Pages) without custom server: safe offline-first mode
        setSyncState("synced");
        return;
      }

      try {
        const res = await fetch(`${apiBase}/api/rooms/${rId}/notes`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.notes)) {
            setNotes((currentNotes) => {
              const merged = mergeNotes(currentNotes, data.notes);
              saveLocalNotes(rId, merged);
              return merged;
            });

            setActiveNoteId((current) => {
              if (current && notesRef.current.some((n: Note) => n.id === current)) {
                return current;
              }
              return loadLocalActiveNoteId(rId, notesRef.current);
            });
            setSyncState("synced");
            setLastSavedAt(Date.now());
          }
        } else {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            setSyncState("offline");
          }
        }
      } catch {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          setSyncState("offline");
        }
      }
    },
    [setActiveNoteId, getApiBase]
  );

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
            let next: Note[];
            if (index >= 0) {
              next = [...prev];
              next[index] = updatedNote;
            } else {
              next = [updatedNote, ...prev];
            }
            saveLocalNotes(roomId, next);
            return next;
          });
          setSyncState("synced");
          setLastSavedAt(Date.now());
        } else if (data.type === "note_delete" && data.noteId) {
          setNotes((prev) => {
            const nextNotes = prev.filter((n) => n.id !== data.noteId);
            saveLocalNotes(roomId, nextNotes);
            if (activeNoteIdRef.current === data.noteId) {
              const nextId = nextNotes.length > 0 ? nextNotes[0].id : "";
              setActiveNoteId(nextId);
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
  }, [roomId, setActiveNoteId]);

  // Periodic polling & window visibility / focus recovery (for phones waking up, tab switching, etc.)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchNotesRest(roomId);
      }
    }, 3000);

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
    const wsTarget = getWsUrl();

    if (!wsTarget) {
      // GitHub Pages or static host without backend: local notes are synced & offline-first
      setIsConnected(false);
      setSyncState("synced");
      return;
    }

    setSyncState("connecting");

    // Immediate initial load
    fetchNotesRest(roomId);

    let reconnectTimer: NodeJS.Timeout | null = null;
    let pingInterval: NodeJS.Timeout | null = null;

    function connectWs() {
      if (!isMounted) return;

      try {
        const ws = new WebSocket(wsTarget!);
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
                setNotes((currentNotes) => {
                  const merged = mergeNotes(currentNotes, data.notes);
                  saveLocalNotes(roomId, merged);
                  return merged;
                });
                setActiveNoteId((curr) => {
                  if (curr && notesRef.current.some((n: Note) => n.id === curr)) return curr;
                  return loadLocalActiveNoteId(roomId, notesRef.current);
                });
              }
              setIsConnected(true);
              setSyncState("synced");
              setLastSavedAt(Date.now());
            } else if (data.type === "note_update" && data.note) {
              const updatedNote: Note = data.note;
              setNotes((prev) => {
                const index = prev.findIndex((n) => n.id === updatedNote.id);
                let next: Note[];
                if (index >= 0) {
                  next = [...prev];
                  next[index] = updatedNote;
                } else {
                  next = [updatedNote, ...prev];
                }
                saveLocalNotes(roomId, next);
                return next;
              });
              setSyncState("synced");
              setLastSavedAt(Date.now());
            } else if (data.type === "note_delete" && data.noteId) {
              setNotes((prev) => {
                const nextNotes = prev.filter((n) => n.id !== data.noteId);
                saveLocalNotes(roomId, nextNotes);
                if (activeNoteIdRef.current === data.noteId) {
                  const nextId = nextNotes.length > 0 ? nextNotes[0].id : "";
                  setActiveNoteId(nextId);
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
          // Keep offline state visible if REST is also down
        };

        ws.onclose = () => {
          setIsConnected(false);
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
  }, [roomId, deviceId, deviceName, deviceColor, fetchNotesRest, setActiveNoteId]);

  // Active note helper
  const activeNote = notes.find((n) => n.id === activeNoteId) || (notes.length > 0 ? notes[0] : null);

  // Update note by ID with instant local sync & debounced network send
  const updateNoteById = useCallback(
    (targetId: string, fields: Partial<Note>) => {
      if (!targetId) return;

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

      // Immediately update local state AND synchronously save to localStorage
      setNotes((prev) => {
        const index = prev.findIndex((n) => n.id === targetId);
        if (index < 0) return prev;
        const copy = [...prev];
        copy[index] = updated;
        saveLocalNotes(roomId, copy);
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
      if (
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN &&
        (fields.content !== undefined || fields.title !== undefined)
      ) {
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

        const apiBase = getApiBase();
        if (apiBase === null) {
          setSyncState("synced");
          setLastSavedAt(Date.now());
          return;
        }

        // REST fallback persist with device ID header
        fetch(`${apiBase}/api/rooms/${roomId}/notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-device-id": deviceId,
          },
          body: JSON.stringify(noteToSend),
        })
          .then((res) => {
            if (res.ok) {
              setSyncState("synced");
              setLastSavedAt(Date.now());
            } else {
              if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                setSyncState("offline");
              }
            }
          })
          .catch((err) => {
            console.warn("Rest save error:", err);
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
              setSyncState("offline");
            }
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

  // Update active note helper
  const updateActiveNote = useCallback(
    (fields: Partial<Note>) => {
      if (!activeNoteIdRef.current) return;
      updateNoteById(activeNoteIdRef.current, fields);
    },
    [updateNoteById]
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

    setNotes((prev) => {
      const nextNotes = [newNote, ...prev];
      saveLocalNotes(roomId, nextNotes);
      return nextNotes;
    });
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
    const apiBase = getApiBase();
    if (apiBase !== null) {
      fetch(`${apiBase}/api/rooms/${roomId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": deviceId,
        },
        body: JSON.stringify(newNote),
      })
        .then((res) => {
          if (res.ok) {
            setSyncState("synced");
            setLastSavedAt(Date.now());
          }
        })
        .catch(() => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            setSyncState("offline");
          }
        });
    } else {
      setSyncState("synced");
      setLastSavedAt(Date.now());
    }

    return newNote;
  }, [roomId, deviceId, deviceName, setActiveNoteId, getApiBase]);

  // Delete note
  const deleteNote = useCallback(
    (id: string) => {
      setNotes((prev) => {
        const nextNotes = prev.filter((n) => n.id !== id);
        saveLocalNotes(roomId, nextNotes);
        if (activeNoteIdRef.current === id) {
          const nextId = nextNotes.length > 0 ? nextNotes[0].id : "";
          setActiveNoteId(nextId);
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
      const apiBase = getApiBase();
      if (apiBase !== null) {
        fetch(`${apiBase}/api/rooms/${roomId}/notes/${id}`, {
          method: "DELETE",
          headers: { "x-device-id": deviceId },
        }).catch(() => {});
      }
    },
    [roomId, deviceId, setActiveNoteId, getApiBase]
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

      setNotes((prev) => {
        const nextNotes = [cloned, ...prev];
        saveLocalNotes(roomId, nextNotes);
        return nextNotes;
      });
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

      const apiBase = getApiBase();
      if (apiBase !== null) {
        fetch(`${apiBase}/api/rooms/${roomId}/notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-device-id": deviceId,
          },
          body: JSON.stringify(cloned),
        }).catch(() => {});
      }
    },
    [roomId, deviceId, deviceName, setActiveNoteId, getApiBase]
  );

  // Force sync / manual refresh
  const forceSync = useCallback(() => {
    setSyncState("saving");
    fetchNotesRest(roomId);
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connectWsRef.current?.();
    }
  }, [roomId, fetchNotesRest]);

  const replaceOrMergeNotes = useCallback(
    (incomingNotes: Note[]) => {
      if (!Array.isArray(incomingNotes) || incomingNotes.length === 0) return;
      setNotes((prevNotes) => {
        const map = new Map<string, Note>();
        prevNotes.forEach((n) => map.set(n.id, n));
        incomingNotes.forEach((inNote) => {
          if (!inNote || !inNote.id) return;
          const existing = map.get(inNote.id);
          if (!existing || (inNote.updatedAt || 0) > (existing.updatedAt || 0)) {
            map.set(inNote.id, inNote);
          }
        });
        const merged = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        saveLocalNotes(roomId, merged);
        setLastSavedAt(Date.now());
        return merged;
      });
    },
    [roomId]
  );

  return {
    notes,
    activeNote,
    activeNoteId,
    roomId,
    setRoomId,
    setActiveNoteId,
    updateActiveNote,
    updateNoteById,
    createNote,
    deleteNote,
    duplicateNote,
    forceSync,
    devices,
    isConnected,
    syncState,
    lastSavedAt,
    remoteTypingDevice,
    deviceName,
    setDeviceName,
    deviceId,
    deviceColor,
    serverUrl,
    setServerUrl,
    isStaticHost,
    replaceOrMergeNotes,
  };
}
