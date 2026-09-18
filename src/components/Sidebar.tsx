import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Pin,
  Trash2,
  Copy,
  FileUp,
  Clock,
  SlidersHorizontal,
  LayoutList,
  AlignJustify,
  LayoutGrid,
  Calendar,
  Sparkles,
  FolderSync,
  X,
  FileText,
} from "lucide-react";
import { Note, NotesViewLayout, AdvancedSearchFilter } from "../types";
import { AdvancedSearchPanel } from "./AdvancedSearchPanel";
import { parseImportedFile } from "../utils/fileImporter";

interface SidebarProps {
  notes: Note[];
  activeNoteId: string;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (id: string) => void;
  onDuplicateNote: (note: Note) => void;
  onTogglePin: (id: string) => void;
  onImportFile: (title: string, content: string) => void;
  onOpenImportModal: () => void;
  isOpen: boolean;
  onCloseMobile: () => void;
  viewLayout: NotesViewLayout;
  onChangeViewLayout: (layout: NotesViewLayout) => void;
}

// Utility to strip HTML tags for card previews and clean searching
function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();
}

export const Sidebar: React.FC<SidebarProps> = ({
  notes,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onDuplicateNote,
  onTogglePin,
  onImportFile,
  onOpenImportModal,
  isOpen,
  onCloseMobile,
  viewLayout,
  onChangeViewLayout,
}) => {
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [filters, setFilters] = useState<AdvancedSearchFilter>({
    query: "",
    dateField: "all",
    dateRange: "all",
    startDate: "",
    endDate: "",
    pinnedOnly: false,
    sortBy: "updated-desc",
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Advanced Filtering and Searching Logic
  const filteredAndSortedNotes = useMemo(() => {
    return notes
      .filter((n) => {
        // Keyword Search across title and full text content
        if (filters.query.trim()) {
          const q = filters.query.toLowerCase().trim();
          const cleanText = stripHtml(n.content || "").toLowerCase();
          const title = (n.title || "").toLowerCase();
          const matches = title.includes(q) || cleanText.includes(q);
          if (!matches) return false;
        }

        // Pinned only filter
        if (filters.pinnedOnly && !n.pinned) {
          return false;
        }

        // Date Filtering
        if (filters.dateRange !== "all") {
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;

          const checkDate = (timestamp: number) => {
            if (filters.dateRange === "today") {
              const startOfToday = new Date().setHours(0, 0, 0, 0);
              return timestamp >= startOfToday;
            }
            if (filters.dateRange === "7days") {
              return timestamp >= now - 7 * dayMs;
            }
            if (filters.dateRange === "30days") {
              return timestamp >= now - 30 * dayMs;
            }
            if (filters.dateRange === "custom") {
              const start = filters.startDate
                ? new Date(filters.startDate).getTime()
                : 0;
              // End date until 23:59:59
              const end = filters.endDate
                ? new Date(filters.endDate).getTime() + dayMs
                : Number.MAX_SAFE_INTEGER;
              return timestamp >= start && timestamp <= end;
            }
            return true;
          };

          if (filters.dateField === "created") {
            if (!checkDate(n.createdAt)) return false;
          } else if (filters.dateField === "updated") {
            if (!checkDate(n.updatedAt)) return false;
          } else {
            // "all" - matches if either created or updated falls into range
            if (!checkDate(n.createdAt) && !checkDate(n.updatedAt)) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        switch (filters.sortBy) {
          case "updated-asc":
            return a.updatedAt - b.updatedAt;
          case "created-desc":
            return b.createdAt - a.createdAt;
          case "created-asc":
            return a.createdAt - b.createdAt;
          case "title-asc":
            return (a.title || "").localeCompare(b.title || "");
          case "title-desc":
            return (b.title || "").localeCompare(a.title || "");
          case "updated-desc":
          default:
            return b.updatedAt - a.updatedAt;
        }
      });
  }, [notes, filters]);

  const pinnedNotes = filteredAndSortedNotes.filter((n) => n.pinned);
  const otherNotes = filteredAndSortedNotes.filter((n) => !n.pinned);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseImportedFile(file);
      onImportFile(parsed.title, parsed.content);
    } catch (err) {
      console.error("Erro ao importar arquivo:", err);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatRelativeTime = (ts: number) => {
    const diffMs = Date.now() - ts;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "Agora mesmo";
    if (diffMin < 60) return `${diffMin}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays === 1) return "Ontem";
    return new Date(ts).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  };

  const hasActiveFilters =
    Boolean(filters.query) ||
    filters.dateRange !== "all" ||
    filters.pinnedOnly ||
    filters.sortBy !== "updated-desc";

  // Render Note based on chosen View Layout
  const renderNoteCard = (note: Note) => {
    const isActive = note.id === activeNoteId;
    const cleanPreview = stripHtml(note.content || "");
    const preview = cleanPreview.slice(0, 90);

    // Compact Layout
    if (viewLayout === "compact") {
      return (
        <div
          key={note.id}
          id={`sidebar-note-compact-${note.id}`}
          onClick={() => {
            onSelectNote(note.id);
            onCloseMobile();
          }}
          className={`group px-2.5 py-2 rounded-lg cursor-pointer transition-all border flex items-center justify-between gap-2 text-left ${
            isActive
              ? "bg-blue-50/90 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-950 dark:text-blue-100 font-medium shadow-2xs"
              : "bg-white dark:bg-neutral-900 border-neutral-200/70 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {note.pinned && <Pin className="w-3 h-3 text-amber-500 fill-current shrink-0" />}
            <span className="text-xs truncate">{note.title || "Sem título"}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-neutral-400 group-hover:hidden">
              {formatRelativeTime(note.updatedAt)}
            </span>
            <div className="hidden group-hover:flex items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(note.id);
                }}
                title={note.pinned ? "Desafixar" : "Fixar"}
                className="p-1 rounded text-neutral-400 hover:text-amber-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Pin className="w-3 h-3" />
              </button>
              {notes.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNote(note.id);
                  }}
                  title="Excluir"
                  className="p-1 rounded text-neutral-400 hover:text-rose-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Grid Layout
    if (viewLayout === "grid") {
      return (
        <div
          key={note.id}
          id={`sidebar-note-grid-${note.id}`}
          onClick={() => {
            onSelectNote(note.id);
            onCloseMobile();
          }}
          className={`group p-2.5 rounded-xl cursor-pointer transition-all border text-left flex flex-col justify-between h-28 ${
            isActive
              ? "bg-blue-50/90 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 shadow-2xs"
              : "bg-white dark:bg-neutral-900 border-neutral-200/70 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
          }`}
        >
          <div>
            <div className="flex items-start justify-between gap-1 mb-1">
              <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate flex-1">
                {note.title || "Sem título"}
              </h4>
              {note.pinned && <Pin className="w-2.5 h-2.5 text-amber-500 fill-current shrink-0" />}
            </div>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 line-clamp-3 leading-relaxed">
              {preview || <span className="italic opacity-50">Vazia</span>}
            </p>
          </div>
          <div className="text-[9px] text-neutral-400 flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
            <span>{formatRelativeTime(note.updatedAt)}</span>
            <span className="font-mono">{cleanPreview.length} carac</span>
          </div>
        </div>
      );
    }

    // Cards / Comfortable Layout
    const isCards = viewLayout === "cards";
    return (
      <div
        key={note.id}
        id={`sidebar-note-card-${note.id}`}
        onClick={() => {
          onSelectNote(note.id);
          onCloseMobile();
        }}
        className={`group relative p-3 rounded-xl cursor-pointer transition-all border text-left ${
          isActive
            ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 shadow-2xs"
            : "bg-white dark:bg-neutral-900 border-neutral-200/70 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
        } ${isCards ? "shadow-xs" : ""}`}
      >
        <div className="flex items-start justify-between gap-1 mb-1">
          <h3
            className={`text-xs font-semibold truncate flex-1 ${
              isActive
                ? "text-blue-950 dark:text-blue-100 font-bold"
                : "text-neutral-800 dark:text-neutral-200"
            }`}
          >
            {note.title || "Sem título"}
          </h3>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(note.id);
              }}
              title={note.pinned ? "Desafixar" : "Fixar no topo"}
              className={`p-1 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-800 ${
                note.pinned ? "text-amber-500 opacity-100" : "text-neutral-400"
              }`}
            >
              <Pin className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateNote(note);
              }}
              title="Duplicar anotação"
              className="p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
            >
              <Copy className="w-3 h-3" />
            </button>

            {notes.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNote(note.id);
                }}
                title="Excluir nota"
                className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <p
          className={`text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed ${
            isCards ? "line-clamp-3" : "line-clamp-2"
          }`}
        >
          {preview || <span className="italic opacity-60">Nota vazia...</span>}
        </p>

        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-neutral-100 dark:border-neutral-800/60 text-[10px] text-neutral-400">
          <span className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {formatRelativeTime(note.updatedAt)}
          </span>
          <span className="font-mono">{cleanPreview.length} caracteres</span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          id="sidebar-mobile-backdrop"
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto w-[86vw] max-w-sm sm:w-80 md:w-72 lg:w-80 xl:w-88 2xl:w-96 bg-neutral-50 dark:bg-neutral-925 border-r border-neutral-200 dark:border-neutral-800 flex flex-col transition-transform duration-200 ease-in-out shadow-2xl md:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:flex"
        } ${!isOpen ? "md:hidden" : ""}`}
      >
        {/* Mobile Header with dedicated Close Button */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-sm text-neutral-900 dark:text-white">Minhas Anotações</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
              {notes.length}
            </span>
          </div>
          <button
            id="close-mobile-sidebar-btn"
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar gaveta de notas"
            className="min-w-[36px] min-h-[36px] p-2 rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top: Search & Action Buttons */}
        <div className="p-3 sm:p-3.5 border-b border-neutral-200/80 dark:border-neutral-800 space-y-2.5 shrink-0">
          {/* Main search bar with Advanced Search trigger */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-3" />
              <input
                id="sidebar-search-input"
                type="text"
                placeholder="Buscar no conteúdo..."
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              id="sidebar-toggle-advanced-search-btn"
              type="button"
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              title="Filtros avançados e busca por data"
              className={`min-w-[38px] min-h-[38px] p-2 rounded-lg border transition-colors flex items-center justify-center shrink-0 ${
                showAdvancedSearch || hasActiveFilters
                  ? "bg-blue-100 dark:bg-blue-900/60 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300 font-semibold"
                  : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* New Note & Upload Actions */}
          <div className="flex gap-2">
            <button
              id="sidebar-new-note-action"
              type="button"
              onClick={() => {
                onCreateNote();
                onCloseMobile();
              }}
              className="flex-1 min-h-[38px] py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              Nova Nota
            </button>

            <button
              id="sidebar-import-file-btn"
              type="button"
              onClick={() => {
                onOpenImportModal();
                onCloseMobile();
              }}
              title="Abrir arquivo (.docx, .doc, .txt, .bat, .html, .rtf, .json, etc.)"
              className="min-w-[38px] min-h-[38px] p-2 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs flex items-center justify-center transition-colors shrink-0"
            >
              <FileUp className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.tft,.bat,.html,.md,.json,.sh,.py,.js,.rtf,.csv,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Layout Selector Bar */}
          <div className="flex items-center justify-between pt-1 text-[11px] text-neutral-500 border-t border-neutral-100 dark:border-neutral-800/60">
            <span className="font-medium">Visualização:</span>
            <div className="flex items-center bg-neutral-200/60 dark:bg-neutral-800/80 p-0.5 rounded-lg gap-0.5">
              {[
                { id: "comfortable", label: "Confortável", icon: LayoutList },
                { id: "compact", label: "Compacto", icon: AlignJustify },
                { id: "cards", label: "Cards", icon: LayoutGrid },
                { id: "grid", label: "Grade 2x", icon: LayoutGrid },
              ].map((layout) => {
                const Icon = layout.icon;
                return (
                  <button
                    key={layout.id}
                    id={`layout-opt-${layout.id}`}
                    type="button"
                    onClick={() => onChangeViewLayout(layout.id as NotesViewLayout)}
                    title={`Layout: ${layout.label}`}
                    className={`p-1 rounded-md transition-colors ${
                      viewLayout === layout.id
                        ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold"
                        : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Collapsible Advanced Search Panel */}
        <AdvancedSearchPanel
          filters={filters}
          onChange={setFilters}
          totalMatches={filteredAndSortedNotes.length}
          totalNotes={notes.length}
          isOpen={showAdvancedSearch}
          onClose={() => setShowAdvancedSearch(false)}
        />

        {/* Notes List Scroll Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {filteredAndSortedNotes.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-400">
              {notes.length === 0 ? (
                <div className="space-y-2">
                  <p>Nenhuma anotação criada ainda.</p>
                  <button
                    id="sidebar-create-first-note"
                    type="button"
                    onClick={onCreateNote}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Criar nova anotação</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <p>Nenhuma anotação corresponde aos critérios de busca.</p>
                  <button
                    type="button"
                    onClick={() =>
                      setFilters({
                        query: "",
                        dateField: "all",
                        dateRange: "all",
                        startDate: "",
                        endDate: "",
                        pinnedOnly: false,
                        sortBy: "updated-desc",
                      })
                    }
                    className="text-blue-600 dark:text-blue-400 underline hover:no-underline cursor-pointer"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {pinnedNotes.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-1 mb-1.5 flex items-center gap-1">
                    <Pin className="w-2.5 h-2.5 text-amber-500" />
                    Fixadas ({pinnedNotes.length})
                  </span>
                  <div
                    className={
                      viewLayout === "grid"
                        ? "grid grid-cols-2 gap-1.5"
                        : "space-y-1.5"
                    }
                  >
                    {pinnedNotes.map(renderNoteCard)}
                  </div>
                </div>
              )}

              <div>
                {pinnedNotes.length > 0 && (
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-1 mb-1.5 block">
                    Todas as Anotações ({otherNotes.length})
                  </span>
                )}
                <div
                  className={
                    viewLayout === "grid"
                      ? "grid grid-cols-2 gap-1.5"
                      : "space-y-1.5"
                  }
                >
                  {otherNotes.map(renderNoteCard)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom Bar / Room Status */}
        <div className="p-3 border-t border-neutral-200/80 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 flex items-center justify-between text-xs text-neutral-500 shrink-0">
          <span className="flex items-center gap-1 text-[11px]">
            <FolderSync className="w-3 h-3 text-emerald-500" />
            {filteredAndSortedNotes.length} de {notes.length} notas
          </span>
          <span className="text-[10px] text-neutral-400">Sincronizado</span>
        </div>
      </aside>
    </>
  );
};
