import React, { useState, useRef } from "react";
import {
  FileUp,
  FileText,
  FileCode,
  FileType,
  X,
  CheckCircle2,
  AlertCircle,
  FilePlus,
  ArrowRight,
} from "lucide-react";
import { parseImportedFile, ParsedImportedFile } from "../utils/fileImporter";

interface OpenFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportNote: (title: string, content: string, asNew: boolean) => void;
  hasActiveNote: boolean;
  activeNoteTitle?: string;
}

export const OpenFileModal: React.FC<OpenFileModalProps> = ({
  isOpen,
  onClose,
  onImportNote,
  hasActiveNote,
  activeNoteTitle,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedImportedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const parsed = await parseImportedFile(file);
      setParsedData(parsed);
    } catch (err: unknown) {
      console.error(err);
      setError("Falha ao abrir ou ler o arquivo selecionado. Verifique se o arquivo não está corrompido.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleConfirmImport = (asNew: boolean) => {
    if (!parsedData) return;
    onImportNote(parsedData.title, parsedData.content, asNew);
    onClose();
    setParsedData(null);
    setError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      id="open-file-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        id="open-file-modal"
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                Abrir Arquivo no Bloco de Notas
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Suporte para DOCX, DOC, TXT, MD, HTML, RTF, BAT, JSON e código
              </p>
            </div>
          </div>
          <button
            id="close-open-file-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* File Dropzone */}
          <div
            id="file-dropzone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 scale-[0.99]"
                : "border-neutral-300 dark:border-neutral-700 hover:border-blue-400 dark:hover:border-blue-600 bg-neutral-50/50 dark:bg-neutral-800/30"
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileUp className="w-6 h-6" />
            </div>

            <div>
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Arraste e solte o arquivo aqui ou{" "}
                <span className="text-blue-600 dark:text-blue-400 underline decoration-dotted">
                  clique para navegar
                </span>
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Arquivos do Word (.docx, .doc), Texto (.txt, .rtf, .md), Web (.html), Scripts (.bat, .sh) e Dados (.json, .csv)
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.doc,.txt,.tft,.rtf,.md,.markdown,.html,.htm,.bat,.cmd,.sh,.json,.csv,.py,.js,.ts,.log,.xml,.css"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400 text-xs font-medium animate-pulse">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Lendo e convertendo conteúdo do arquivo...
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Parsed File Success Box */}
          {parsedData && !loading && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                      {parsedData.title}
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Formato identificado:{" "}
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                        {parsedData.format}
                      </span>{" "}
                      • Tamanho: {formatFileSize(parsedData.size)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 flex flex-col sm:flex-row gap-2">
                <button
                  id="import-as-new-note-btn"
                  type="button"
                  onClick={() => handleConfirmImport(true)}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                >
                  <FilePlus className="w-4 h-4" />
                  Abrir como Nova Nota
                </button>

                {hasActiveNote && (
                  <button
                    id="import-replace-note-btn"
                    type="button"
                    onClick={() => handleConfirmImport(false)}
                    className="flex-1 py-2 px-3 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Substituir na Nota Atual
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Supported File Formats Grid */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Formatos Suportados para Abertura
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 flex items-center gap-2">
                <FileType className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">Word</div>
                  <div className="text-[10px] text-neutral-500">.docx, .doc, .rtf</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">Texto</div>
                  <div className="text-[10px] text-neutral-500">.txt, .md, .log</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">Scripts</div>
                  <div className="text-[10px] text-neutral-500">.bat, .cmd, .sh</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">Web / Dados</div>
                  <div className="text-[10px] text-neutral-500">.html, .json, .csv</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
