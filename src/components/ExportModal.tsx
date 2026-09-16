import React, { useState } from "react";
import { X, Download, Copy, Check, FileText, Code, FileTerminal, Database, Sparkles } from "lucide-react";
import { Note, ExportFormatId } from "../types";
import { EXPORT_FORMATS, exportNote } from "../utils/exportNotes";

interface ExportModalProps {
  note: Note;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ note, isOpen, onClose }) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatId>("txt");
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("todos");

  if (!isOpen) return null;

  const currentOption = EXPORT_FORMATS.find((f) => f.id === selectedFormat) || EXPORT_FORMATS[0];

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportNote(note, selectedFormat);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(note.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredFormats = EXPORT_FORMATS.filter((fmt) => {
    if (activeCategory === "todos") return true;
    return fmt.category === activeCategory;
  });

  const getFormatIcon = (category: string) => {
    switch (category) {
      case "documentos":
        return <FileText className="w-4 h-4 text-blue-500" />;
      case "scripts":
        return <FileTerminal className="w-4 h-4 text-emerald-500" />;
      case "codigo":
        return <Code className="w-4 h-4 text-amber-500" />;
      case "dados":
        return <Database className="w-4 h-4 text-purple-500" />;
      default:
        return <FileText className="w-4 h-4 text-neutral-500" />;
    }
  };

  return (
    <div
      id="export-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="export-modal"
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Salvar / Exportar Nota
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Escolha o formato desejado para salvar ou baixar em seu dispositivo
            </p>
          </div>
          <button
            id="close-export-modal"
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 px-6 pt-3 pb-2 border-b border-neutral-100 dark:border-neutral-800 overflow-x-auto text-xs">
          {[
            { id: "todos", label: "Todos os Formatos" },
            { id: "documentos", label: "Documentos (PDF, Word)" },
            { id: "texto", label: "Texto Simples (TXT, TFT)" },
            { id: "scripts", label: "Scripts (BAT, Shell)" },
            { id: "codigo", label: "Código & Dados" },
          ].map((cat) => (
            <button
              key={cat.id}
              id={`filter-category-${cat.id}`}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap ${
                activeCategory === cat.id
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Format Selection Grid */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredFormats.map((fmt) => {
            const isSelected = selectedFormat === fmt.id;
            return (
              <button
                key={fmt.id}
                id={`format-option-${fmt.id}`}
                type="button"
                onClick={() => setSelectedFormat(fmt.id)}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 relative ${
                  isSelected
                    ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-500 ring-2 ring-blue-500/20"
                    : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/40"
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-neutral-700 border border-neutral-200/60 dark:border-neutral-600"
                  }`}
                >
                  {getFormatIcon(fmt.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-neutral-900 dark:text-white">
                      .{fmt.extension.toUpperCase()}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {fmt.label}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                    {fmt.description}
                  </p>
                </div>
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 absolute top-3.5 right-3.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/60 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 w-full sm:w-auto">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="truncate">
              Arquivo: <strong className="text-neutral-700 dark:text-neutral-200">{note.title || "nota"}.{currentOption.extension}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              id="copy-note-content-btn"
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado!" : "Copiar Texto"}
            </button>

            <button
              id="download-format-btn"
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {isExporting ? "Gerando..." : `Baixar .${currentOption.extension.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
