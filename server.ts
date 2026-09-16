import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;
}

interface ClientMeta {
  ws: WebSocket;
  roomId: string;
  deviceId: string;
  deviceName: string;
  deviceColor: string;
  lastSeen: number;
  currentNoteId?: string;
  isTyping?: boolean;
}

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getRoomFilePath(roomId: string): string {
  const safeRoom = roomId.replace(/[^a-zA-Z0-9_-]/g, "_") || "default";
  return path.join(DATA_DIR, `room_${safeRoom}.json`);
}

function loadRoomNotes(roomId: string): Note[] {
  const filePath = getRoomFilePath(roomId);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error(`Error loading room ${roomId} notes:`, err);
  }

  // Default initial note if room is brand new
  const initialNote: Note = {
    id: "welcome-note",
    title: "Bem-vindo ao Bloco de Notas Nuvem",
    content: `Bem-vindo ao seu Bloco de Notas com Sincronização em Tempo Real e Nuvem! 🚀

Recursos principais:
• ☁️ Salvamento automático contínuo na nuvem
• 🔄 Sincronização em tempo real entre celulares, tablets e computadores
• 💾 Exportação em múltiplos formatos: PDF, DOC, DOCX, TXT, TFT, BAT, HTML, MD, JSON, etc.
• 📱 Conexão instantânea por Código de Sala ou QR Code
• 🎨 Fontes ajustáveis (Mono, Sans, Serif) e temas personalizáveis
• 🔍 Ferramenta de Localizar e Substituir (Ctrl+F)
• 📋 Contagem ao vivo de palavras, caracteres, linhas e tempo de leitura

Para testar a sincronização em tempo real:
1. Abra esta mesma página em outra aba ou em seu smartphone.
2. Digite aqui e veja o texto se atualizar instantaneamente no outro dispositivo!`,
    tags: ["Boas-vindas", "Tutorial"],
    pinned: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  };

  saveRoomNotes(roomId, [initialNote]);
  return [initialNote];
}

function saveRoomNotes(roomId: string, notes: Note[]): void {
  const filePath = getRoomFilePath(roomId);
  try {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(notes, null, 2), "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Error saving room ${roomId} notes:`, err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json({ limit: "15mb" }));

  // REST API Routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: Date.now() });
  });

  // Get notes for a room
  app.get("/api/rooms/:roomId/notes", (req, res) => {
    const roomId = req.params.roomId || "default";
    const notes = loadRoomNotes(roomId);
    res.json({ roomId, notes });
  });

  // Save or update note
  app.post("/api/rooms/:roomId/notes", (req, res) => {
    const roomId = req.params.roomId || "default";
    const note: Note = req.body;
    if (!note || !note.id) {
      res.status(400).json({ error: "Invalid note payload" });
      return;
    }

    const notes = loadRoomNotes(roomId);
    const existingIndex = notes.findIndex((n) => n.id === note.id);
    if (existingIndex >= 0) {
      notes[existingIndex] = { ...note, updatedAt: Date.now() };
    } else {
      notes.unshift({ ...note, updatedAt: Date.now() });
    }
    saveRoomNotes(roomId, notes);
    res.json({ success: true, note });
  });

  // Delete note
  app.delete("/api/rooms/:roomId/notes/:noteId", (req, res) => {
    const { roomId, noteId } = req.params;
    const notes = loadRoomNotes(roomId);
    const filtered = notes.filter((n) => n.id !== noteId);
    saveRoomNotes(roomId, filtered);
    res.json({ success: true, noteId });
  });

  // WebSocket Server for instant multi-device real-time sync
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Map<WebSocket, ClientMeta>();

  function broadcastRoomPresence(roomId: string) {
    const roomDevices: Array<{
      id: string;
      name: string;
      color: string;
      lastSeen: number;
      currentNoteId?: string;
      isTyping?: boolean;
    }> = [];

    for (const [, meta] of clients.entries()) {
      if (meta.roomId === roomId) {
        roomDevices.push({
          id: meta.deviceId,
          name: meta.deviceName,
          color: meta.deviceColor,
          lastSeen: meta.lastSeen,
          currentNoteId: meta.currentNoteId,
          isTyping: meta.isTyping,
        });
      }
    }

    const payload = JSON.stringify({
      type: "presence",
      roomId,
      devices: roomDevices,
      timestamp: Date.now(),
    });

    for (const [ws, meta] of clients.entries()) {
      if (meta.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  wss.on("connection", (ws: WebSocket) => {
    ws.on("message", (raw: string) => {
      try {
        const msg = JSON.parse(raw.toString());
        const { type, roomId, deviceId, deviceName, deviceColor, note, noteId, isTyping, currentNoteId } = msg;

        if (type === "join") {
          clients.set(ws, {
            ws,
            roomId: roomId || "default",
            deviceId: deviceId || "unknown",
            deviceName: deviceName || "Dispositivo",
            deviceColor: deviceColor || "#3b82f6",
            lastSeen: Date.now(),
            currentNoteId,
          });

          // Send current authoritative notes list
          const currentNotes = loadRoomNotes(roomId || "default");
          ws.send(
            JSON.stringify({
              type: "init",
              roomId: roomId || "default",
              notes: currentNotes,
              timestamp: Date.now(),
            })
          );

          broadcastRoomPresence(roomId || "default");
          return;
        }

        const clientMeta = clients.get(ws);
        if (!clientMeta) return;

        clientMeta.lastSeen = Date.now();
        if (currentNoteId !== undefined) clientMeta.currentNoteId = currentNoteId;
        if (isTyping !== undefined) clientMeta.isTyping = isTyping;

        if (type === "note_update" && note) {
          const targetRoom = clientMeta.roomId;
          const notes = loadRoomNotes(targetRoom);
          const index = notes.findIndex((n) => n.id === note.id);
          if (index >= 0) {
            notes[index] = { ...note, updatedAt: Date.now() };
          } else {
            notes.unshift({ ...note, updatedAt: Date.now() });
          }
          saveRoomNotes(targetRoom, notes);

          // Broadcast update to all other devices in the same room
          const broadcastMsg = JSON.stringify({
            type: "note_update",
            roomId: targetRoom,
            deviceId: clientMeta.deviceId,
            deviceName: clientMeta.deviceName,
            note,
            timestamp: Date.now(),
          });

          for (const [otherWs, otherMeta] of clients.entries()) {
            if (otherMeta.roomId === targetRoom && otherWs !== ws && otherWs.readyState === WebSocket.OPEN) {
              otherWs.send(broadcastMsg);
            }
          }
        } else if (type === "note_delete" && noteId) {
          const targetRoom = clientMeta.roomId;
          const notes = loadRoomNotes(targetRoom);
          const filtered = notes.filter((n) => n.id !== noteId);
          saveRoomNotes(targetRoom, filtered);

          const broadcastMsg = JSON.stringify({
            type: "note_delete",
            roomId: targetRoom,
            deviceId: clientMeta.deviceId,
            noteId,
            timestamp: Date.now(),
          });

          for (const [otherWs, otherMeta] of clients.entries()) {
            if (otherMeta.roomId === targetRoom && otherWs !== ws && otherWs.readyState === WebSocket.OPEN) {
              otherWs.send(broadcastMsg);
            }
          }
        } else if (type === "typing") {
          // Broadcast typing status
          const targetRoom = clientMeta.roomId;
          const broadcastMsg = JSON.stringify({
            type: "typing",
            roomId: targetRoom,
            deviceId: clientMeta.deviceId,
            deviceName: clientMeta.deviceName,
            noteId,
            isTyping: !!isTyping,
            timestamp: Date.now(),
          });

          for (const [otherWs, otherMeta] of clients.entries()) {
            if (otherMeta.roomId === targetRoom && otherWs !== ws && otherWs.readyState === WebSocket.OPEN) {
              otherWs.send(broadcastMsg);
            }
          }
        }
      } catch (err) {
        console.error("Error processing websocket message:", err);
      }
    });

    ws.on("close", () => {
      const meta = clients.get(ws);
      if (meta) {
        const rId = meta.roomId;
        clients.delete(ws);
        broadcastRoomPresence(rId);
      }
    });
  });

  // Vite development middleware or production static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
