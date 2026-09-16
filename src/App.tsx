import React, { useState, useEffect } from "react";
import { useRealtimeSync } from "./hooks/useRealtimeSync";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { RichEditor } from "./components/RichEditor";
import { ExportModal } from "./components/ExportModal";
import { DeviceSyncModal } from "./components/DeviceSyncModal";
import { FindReplaceBar } from "./components/FindReplaceBar";
import { OpenFileModal } from "./components/OpenFileModal";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { parseImportedFile } from "./utils/fileImporter";
import { EditorFont, EditorTheme, NotesViewLayout } from "./types";

export default function App() {
  const {
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
  } = useRealtimeSync();

  const [font, setFont] = useState<EditorFont>(() => {
    return (localStorage.getItem("bloco_font") as EditorFont) || "sans";
  });

  const [theme, setTheme] = useState<EditorTheme>(() => {
    return (localStorage.getItem("bloco_theme") as EditorTheme) || "default";
  });

  const [viewLayout, setViewLayout] = useState<NotesViewLayout>(() => {
    return (
      (localStorage.getItem("bloco_notes_view_layout") as NotesViewLayout) ||
      "comfortable"
    );
  });

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isFindBarOpen, setIsFindBarOpen] = useState(false);
  const [isOpenFileModalOpen, setIsOpenFileModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isWindowDragging, setIsWindowDragging] = useState(false);

  // Sync theme with html root class for Tailwind dark: variants
  useEffect(() => {
    localStorage.setItem("bloco_theme", theme);
    const root = document.documentElement;
    if (theme === "dark" || theme === "terminal") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Sync font preference
  useEffect(() => {
    localStorage.setItem("bloco_font", font);
  }, [font]);

  // Sync view layout preference
  useEffect(() => {
    localStorage.setItem("bloco_notes_view_layout", viewLayout);
  }, [viewLayout]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S -> Open Export Modal
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setIsExportModalOpen(true);
      }
      // Ctrl+O / Cmd+O -> Open File Modal
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setIsOpenFileModalOpen(true);
      }
      // Ctrl+F / Cmd+F -> Toggle Find/Replace
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setIsFindBarOpen((prev) => !prev);
      }
      // Ctrl+Alt+N -> New Note
      else if (
        (e.ctrlKey || e.metaKey) &&
        e.altKey &&
        e.key.toLowerCase() === "n"
      ) {
        e.preventDefault();
        createNote();
      }
      // Esc -> Close modals / Find
      else if (e.key === "Escape") {
        setIsExportModalOpen(false);
        setIsSyncModalOpen(false);
        setIsFindBarOpen(false);
        setIsOpenFileModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createNote]);

  // Global Drag & Drop listener for quick file opening
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes("Files")) {
        setIsWindowDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // Only dismiss if leaving window
      if (e.clientX === 0 || e.clientY === 0) {
        setIsWindowDragging(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      setIsWindowDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        try {
          const parsed = await parseImportedFile(file);
          createNote();
          setTimeout(() => {
            updateActiveNote({ title: parsed.title, content: parsed.content });
          }, 50);
        } catch (err) {
          console.error("Falha ao abrir arquivo arrastado:", err);
          setIsOpenFileModalOpen(true);
        }
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [createNote, updateActiveNote]);

  const handleTogglePin = (id: string) => {
    const target = notes.find((n) => n.id === id);
    if (target) {
      updateActiveNote({ pinned: !target.pinned });
    }
  };

  const handleImportFile = (title: string, content: string) => {
    createNote();
    setTimeout(() => {
      updateActiveNote({ title, content });
    }, 50);
  };

  const handleImportNoteWithMode = (
    title: string,
    content: string,
    asNew: boolean
  ) => {
    if (asNew || !activeNote) {
      createNote();
      setTimeout(() => {
        updateActiveNote({ title, content });
      }, 50);
    } else {
      updateActiveNote({ title, content });
    }
  };

  return (
    <div
      id="notepad-app-root"
      className="h-screen w-screen flex flex-col overflow-hidden bg-neutral-100 dark:bg-neutral-950 font-sans antialiased text-neutral-900 dark:text-neutral-100 relative"
    >
      {/* Header */}
      <Header
        onNewNote={createNote}
        onOpenFileModal={() => setIsOpenFileModalOpen(true)}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onToggleFind={() => setIsFindBarOpen((prev) => !prev)}
        isFindOpen={isFindBarOpen}
        syncState={syncState}
        lastSavedAt={lastSavedAt}
        connectedDevicesCount={devices.length}
        font={font}
        setFont={setFont}
        theme={theme}
        setTheme={setTheme}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isSidebarOpen={isSidebarOpen}
      />

      {/* Find and Replace Bar */}
      {isFindBarOpen && activeNote && (
        <FindReplaceBar
          content={activeNote.content || ""}
          onReplace={(newContent) => updateActiveNote({ content: newContent })}
          onClose={() => setIsFindBarOpen(false)}
        />
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar with Advanced Search & Layout Switcher */}
        <Sidebar
          notes={notes}
          activeNoteId={activeNoteId}
          onSelectNote={(id) => setActiveNoteId(id)}
          onCreateNote={createNote}
          onDeleteNote={deleteNote}
          onDuplicateNote={duplicateNote}
          onTogglePin={handleTogglePin}
          onImportFile={handleImportFile}
          onOpenImportModal={() => setIsOpenFileModalOpen(true)}
          isOpen={isSidebarOpen}
          onCloseMobile={() => setIsSidebarOpen(false)}
          viewLayout={viewLayout}
          onChangeViewLayout={setViewLayout}
        />

        {/* Rich Text Editor */}
        <RichEditor
          note={activeNote}
          onUpdateNote={updateActiveNote}
          font={font}
          theme={theme}
          remoteTypingDevice={remoteTypingDevice}
          onOpenExport={() => setIsExportModalOpen(true)}
        />
      </div>

      {/* Export Format Modal */}
      {activeNote && (
        <ExportModal
          note={activeNote}
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {/* Open / Import Any File Modal */}
      <OpenFileModal
        isOpen={isOpenFileModalOpen}
        onClose={() => setIsOpenFileModalOpen(false)}
        onImportNote={handleImportNoteWithMode}
        hasActiveNote={Boolean(activeNote)}
        activeNoteTitle={activeNote?.title}
      />

      {/* Multi-Device Real-Time Sync Modal */}
      <DeviceSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        roomId={roomId}
        setRoomId={setRoomId}
        devices={devices}
        isConnected={isConnected}
        deviceId={deviceId}
        deviceName={deviceName}
        setDeviceName={setDeviceName}
      />

      {/* Global Drag-and-Drop Overlay Indicator */}
      {isWindowDragging && (
        <div
          id="window-drag-overlay"
          className="fixed inset-0 z-50 bg-blue-600/90 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-white pointer-events-none p-6 text-center animate-fade-in"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 animate-bounce"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold">Solte o arquivo para abrir no Bloco de Notas</h3>
          <p className="text-sm opacity-90 max-w-md">
            Compatível com DOCX, DOC, TXT, MD, HTML, RTF, BAT, JSON, Código e scripts
          </p>
        </div>
      )}

      {/* PWA Offline Status Toast */}
      <OfflineIndicator />
    </div>
  );
}
