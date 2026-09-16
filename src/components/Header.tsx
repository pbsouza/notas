import React from "react";
import {
  FileText,
  Cloud,
  CloudCheck,
  Radio,
  Download,
  Search,
  Plus,
  Moon,
  Sun,
  Palette,
  Type,
  Maximize2,
  Menu,
  ChevronDown,
  FolderOpen,
} from "lucide-react";
import { EditorFont, EditorTheme } from "../types";
import { PWAInstallButton } from "./PWAInstallButton";

interface HeaderProps {
  onNewNote: () => void;
  onOpenFileModal: () => void;
  onOpenExport: () => void;
  onOpenSyncModal: () => void;
  onToggleFind: () => void;
  isFindOpen: boolean;
  syncState: "synced" | "saving" | "offline" | "connecting";
  lastSavedAt: number | null;
  connectedDevicesCount: number;
  font: EditorFont;
  setFont: (font: EditorFont) => void;
  theme: EditorTheme;
  setTheme: (theme: EditorTheme) => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onNewNote,
  onOpenFileModal,
  onOpenExport,
  onOpenSyncModal,
  onToggleFind,
  isFindOpen,
  syncState,
  lastSavedAt,
  connectedDevicesCount,
  font,
  setFont,
  theme,
  setTheme,
  onToggleSidebar,
  isSidebarOpen,
}) => {
  const [showThemeMenu, setShowThemeMenu] = React.useState(false);
  const [showFontMenu, setShowFontMenu] = React.useState(false);

  const formatSavedTime = (ts: number | null) => {
    if (!ts) return "Salvo na nuvem";
    const date = new Date(ts);
    return `Salvo às ${date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;
  };

  return (
    <header
      id="app-header"
      className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 sm:px-4 flex items-center justify-between gap-2 select-none relative z-30 shrink-0"
    >
      {/* Left: Sidebar toggle + Brand */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          id="toggle-sidebar-btn"
          type="button"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? "Recolher barra lateral" : "Expandir barra lateral"}
          className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shadow-xs">
            <FileText className="w-4 h-4" />
          </div>
          <div className="hidden sm:flex flex-col">
            <h1 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white leading-tight">
              Bloco de Notas Nuvem
            </h1>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-none">
              Sincronizado em Tempo Real
            </span>
          </div>
        </div>

        <button
          id="header-new-note-btn"
          type="button"
          onClick={onNewNote}
          className="ml-1 sm:ml-2 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg border border-blue-200/60 dark:border-blue-800/60 flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Nova Nota</span>
        </button>

        <button
          id="header-open-file-btn"
          type="button"
          onClick={onOpenFileModal}
          title="Abrir arquivo (.docx, .doc, .txt, .bat, .html, .rtf, .json, etc.)"
          className="px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center gap-1 transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span className="hidden sm:inline">Abrir Arquivo</span>
        </button>
      </div>

      {/* Center: Cloud Auto-Save & Multi-Device Sync Pill */}
      <div className="flex items-center gap-2">
        {/* Cloud Auto-Save Status */}
        <div
          id="cloud-save-status-badge"
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700/60"
        >
          {syncState === "saving" ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
              <span className="text-[11px] text-amber-600 dark:text-amber-400">Salvando na nuvem...</span>
            </>
          ) : syncState === "synced" ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px] text-neutral-600 dark:text-neutral-300">
                {formatSavedTime(lastSavedAt)}
              </span>
            </>
          ) : syncState === "offline" ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-[11px] text-neutral-500">Salvo localmente (offline)</span>
            </>
          ) : (
            <>
              <Cloud className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              <span className="text-[11px] text-blue-500">Conectando à nuvem...</span>
            </>
          )}
        </div>

        {/* Live Multi-Device Sync Pill */}
        <button
          id="open-sync-device-btn"
          type="button"
          onClick={onOpenSyncModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors shadow-2xs"
          title="Clique para gerenciar e conectar celulares e outros dispositivos"
        >
          <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
          <span className="text-[11px] font-semibold whitespace-nowrap">
            {connectedDevicesCount > 1
              ? `${connectedDevicesCount} Aparelhos`
              : "Sincronizar Celular"}
          </span>
        </button>
      </div>

      {/* Right: Actions (Find, Font, Theme, Export) */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Find & Replace button */}
        <button
          id="toggle-find-btn"
          type="button"
          onClick={onToggleFind}
          className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
            isFindOpen
              ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
              : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
          title="Localizar e Substituir (Ctrl+F)"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Font Selector Dropdown */}
        <div className="relative">
          <button
            id="font-selector-btn"
            type="button"
            onClick={() => {
              setShowFontMenu(!showFontMenu);
              setShowThemeMenu(false);
            }}
            className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1 transition-colors text-xs"
            title="Alterar tipografia da nota"
          >
            <Type className="w-4 h-4" />
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {showFontMenu && (
            <div
              id="font-dropdown-menu"
              className="absolute right-0 mt-1 w-36 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg p-1.5 z-40 text-xs animate-in fade-in"
              onClick={() => setShowFontMenu(false)}
            >
              {[
                { id: "mono", label: "Mono (Terminal)", style: "font-mono" },
                { id: "sans", label: "Sans (Moderno)", style: "font-sans" },
                { id: "serif", label: "Serif (Leitura)", style: "font-serif" },
              ].map((f) => (
                <button
                  key={f.id}
                  id={`font-opt-${f.id}`}
                  type="button"
                  onClick={() => setFont(f.id as EditorFont)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between ${
                    font === f.id
                      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-medium"
                      : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  } ${f.style}`}
                >
                  <span>{f.label}</span>
                  {font === f.id && <span className="text-blue-500">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Quick Toggle (Light / Dark) */}
        <button
          id="theme-toggle-light-dark-btn"
          type="button"
          onClick={() => setTheme(theme === "dark" || theme === "terminal" ? "default" : "dark")}
          className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-xs"
          title={theme === "dark" || theme === "terminal" ? "Mudar para Tema Claro" : "Mudar para Tema Escuro"}
          aria-label="Alternar tema claro e escuro"
        >
          {theme === "dark" || theme === "terminal" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-neutral-700" />
          )}
        </button>

        {/* Theme Selector */}
        <div className="relative">
          <button
            id="theme-selector-btn"
            type="button"
            onClick={() => {
              setShowThemeMenu(!showThemeMenu);
              setShowFontMenu(false);
            }}
            className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1 transition-colors text-xs"
            title="Escolher entre temas visuais (Claro, Escuro, Papel, Sépia, Terminal)"
          >
            <Palette className="w-4 h-4" />
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {showThemeMenu && (
            <div
              id="theme-dropdown-menu"
              className="absolute right-0 mt-1 w-40 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg p-1.5 z-40 text-xs animate-in fade-in"
              onClick={() => setShowThemeMenu(false)}
            >
              {[
                { id: "default", label: "Claro Padrão", icon: Sun },
                { id: "paper", label: "Papel Amarelado", icon: FileText },
                { id: "dark", label: "Escuro Noturno", icon: Moon },
                { id: "sepia", label: "Sépia Leitura", icon: Palette },
                { id: "terminal", label: "Terminal Retrô", icon: Maximize2 },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    id={`theme-opt-${t.id}`}
                    type="button"
                    onClick={() => setTheme(t.id as EditorTheme)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between ${
                      theme === t.id
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-medium"
                        : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 opacity-70" />
                      <span>{t.label}</span>
                    </div>
                    {theme === t.id && <span className="text-blue-500">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* PWA In-App Install Button */}
        <PWAInstallButton />

        {/* Primary Action: Export / Salvar Como */}
        <button
          id="header-export-btn"
          type="button"
          onClick={onOpenExport}
          className="ml-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 flex items-center gap-1.5 transition-all shadow-xs"
          title="Salvar como PDF, DOCX, DOC, BAT, TXT, HTML e outros"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Salvar Como...</span>
          <span className="xs:hidden">Salvar</span>
        </button>
      </div>
    </header>
  );
};
