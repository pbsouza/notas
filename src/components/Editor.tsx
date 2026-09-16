import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  AlignLeft,
  WrapText,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  Radio,
  Clock,
  Hash,
} from "lucide-react";
import { Note, EditorFont, EditorTheme } from "../types";

interface EditorProps {
  note: Note | null;
  onUpdateNote: (fields: Partial<Note>) => void;
  font: EditorFont;
  theme: EditorTheme;
  remoteTypingDevice: string | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onOpenExport: () => void;
}

export const Editor: React.FC<EditorProps> = ({
  note,
  onUpdateNote,
  font,
  theme,
  remoteTypingDevice,
  textareaRef,
  onOpenExport,
}) => {
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [copied, setCopied] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Synchronize scroll between line numbers gutter and textarea
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const updateCursorPosition = () => {
    if (!textareaRef.current) return;
    const text = textareaRef.current.value.slice(0, textareaRef.current.selectionStart);
    const lines = text.split("\n");
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
  };

  // Keyboard enhancements (Tab key, Indentation)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!textareaRef.current || !note) return;

    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      // Insert 2 spaces
      const updated = val.substring(0, start) + "  " + val.substring(end);
      onUpdateNote({ content: updated });

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        updateCursorPosition();
      }, 0);
    }
  };

  const handleCopyAll = async () => {
    if (!note) return;
    try {
      await navigator.clipboard.writeText(note.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-neutral-400">
        <div>
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-40 text-neutral-400" />
          <p className="text-sm font-medium">Nenhuma nota selecionada</p>
          <p className="text-xs text-neutral-500 mt-1">
            Selecione uma nota na barra lateral ou crie uma nova.
          </p>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const content = note.content || "";
  const linesArray = content.split("\n");
  const totalLines = linesArray.length;
  const totalChars = content.length;
  const totalWords = (content.trim().match(/\S+/g) || []).length;
  const readingTimeMin = Math.max(1, Math.ceil(totalWords / 200));

  // Determine font classes
  const fontClass =
    font === "mono"
      ? "font-mono tracking-tight text-[13.5px] leading-relaxed"
      : font === "serif"
      ? "font-serif text-[16px] leading-relaxed"
      : "font-sans text-[15px] leading-relaxed";

  // Determine theme styling
  const getThemeClasses = () => {
    switch (theme) {
      case "paper":
        return {
          container: "bg-[#fcfbf7] text-[#2c2825]",
          textarea: "bg-transparent text-[#2c2825] placeholder-[#8c827a]",
          gutter: "bg-[#f5f3ec] text-[#a89f91] border-r border-[#e8e4d8]",
          statusBar: "bg-[#f5f3ec] text-[#6d645b] border-t border-[#e8e4d8]",
          titleInput: "text-[#1f1c19] placeholder-[#8c827a] border-b border-[#e8e4d8]",
        };
      case "dark":
        return {
          container: "bg-neutral-900 text-neutral-100",
          textarea: "bg-transparent text-neutral-100 placeholder-neutral-500",
          gutter: "bg-neutral-950 text-neutral-600 border-r border-neutral-800",
          statusBar: "bg-neutral-950 text-neutral-400 border-t border-neutral-800",
          titleInput: "text-white placeholder-neutral-500 border-b border-neutral-800",
        };
      case "sepia":
        return {
          container: "bg-[#f4ecd8] text-[#433422]",
          textarea: "bg-transparent text-[#433422] placeholder-[#8c7355]",
          gutter: "bg-[#ebdcc0] text-[#937b5f] border-r border-[#decaaa]",
          statusBar: "bg-[#ebdcc0] text-[#786145] border-t border-[#decaaa]",
          titleInput: "text-[#322617] placeholder-[#8c7355] border-b border-[#decaaa]",
        };
      case "terminal":
        return {
          container: "bg-[#0c1017] text-[#38ef7d]",
          textarea: "bg-transparent text-[#38ef7d] placeholder-[#1c693a] font-mono",
          gutter: "bg-[#06080d] text-[#1f5c35] border-r border-[#153120]",
          statusBar: "bg-[#06080d] text-[#2ba059] border-t border-[#153120]",
          titleInput: "text-[#4dfa92] placeholder-[#1c693a] font-mono border-b border-[#153120]",
        };
      case "default":
      default:
        return {
          container: "bg-white text-neutral-900",
          textarea: "bg-transparent text-neutral-900 placeholder-neutral-400",
          gutter: "bg-neutral-50 text-neutral-400 border-r border-neutral-200",
          statusBar: "bg-neutral-50 text-neutral-500 border-t border-neutral-200",
          titleInput: "text-neutral-900 placeholder-neutral-400 border-b border-neutral-200",
        };
    }
  };

  const themeClasses = getThemeClasses();

  return (
    <div id="editor-wrapper" className={`flex-1 flex flex-col h-full overflow-hidden ${themeClasses.container}`}>
      {/* Remote typing indicator banner */}
      {remoteTypingDevice && (
        <div
          id="remote-typing-banner"
          className="bg-blue-600 text-white text-xs px-4 py-1.5 flex items-center justify-between animate-in slide-in-from-top duration-150 shrink-0"
        >
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>
              <strong>{remoteTypingDevice}</strong> está editando esta anotação em tempo real...
            </span>
          </div>
          <span className="text-[10px] bg-blue-700/80 px-2 py-0.5 rounded-full font-medium">
            Sincronizado
          </span>
        </div>
      )}

      {/* Editor Title & Quick Formatting Bar */}
      <div className={`px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${themeClasses.titleInput} shrink-0`}>
        <input
          id="note-title-input"
          type="text"
          value={note.title || ""}
          onChange={(e) => onUpdateNote({ title: e.target.value })}
          placeholder="Título da anotação..."
          className="text-lg sm:text-xl font-bold bg-transparent outline-none flex-1 min-w-0"
        />

        {/* Action Toggles */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs shrink-0">
          <button
            id="toggle-line-numbers"
            type="button"
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            title="Alternar números de linha (ótimo para código/bat/html)"
            className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors ${
              showLineNumbers
                ? "bg-neutral-200/70 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Linhas</span>
          </button>

          <button
            id="toggle-word-wrap"
            type="button"
            onClick={() => setWordWrap(!wordWrap)}
            title="Quebra automática de linha"
            className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors ${
              wordWrap
                ? "bg-neutral-200/70 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            <WrapText className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Quebra</span>
          </button>

          <button
            id="copy-editor-content"
            type="button"
            onClick={handleCopyAll}
            title="Copiar todo o conteúdo"
            className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 flex items-center gap-1 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{copied ? "Copiado!" : "Copiar"}</span>
          </button>

          <button
            id="editor-export-shortcut-btn"
            type="button"
            onClick={onOpenExport}
            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-medium flex items-center gap-1 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            <span>Formatos...</span>
          </button>
        </div>
      </div>

      {/* Main Textarea Area with synchronized Line Numbers */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Line Numbers Column */}
        {showLineNumbers && (
          <div
            ref={lineNumbersRef}
            id="editor-line-numbers-gutter"
            className={`w-12 sm:w-14 py-4 px-2 text-right select-none overflow-hidden font-mono text-xs opacity-50 shrink-0 ${themeClasses.gutter}`}
            aria-hidden="true"
          >
            {Array.from({ length: Math.max(totalLines, 1) }, (_, i) => (
              <div key={i} className="leading-relaxed">
                {i + 1}
              </div>
            ))}
          </div>
        )}

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          id="main-notepad-textarea"
          value={note.content || ""}
          onChange={(e) => {
            onUpdateNote({ content: e.target.value });
            updateCursorPosition();
          }}
          onScroll={handleScroll}
          onClick={updateCursorPosition}
          onKeyUp={updateCursorPosition}
          onKeyDown={handleKeyDown}
          placeholder="Comece a digitar seu texto aqui... Suas alterações são salvas automaticamente na nuvem e sincronizadas com todos os aparelhos."
          wrap={wordWrap ? "soft" : "off"}
          spellCheck={false}
          className={`flex-1 w-full h-full p-4 resize-none outline-none overflow-y-auto ${fontClass} ${themeClasses.textarea} ${
            !wordWrap ? "overflow-x-auto whitespace-pre" : "whitespace-pre-wrap"
          }`}
        />
      </div>

      {/* Bottom Status Bar */}
      <footer
        id="editor-status-bar"
        className={`h-7 px-4 flex items-center justify-between text-[11px] font-mono shrink-0 select-none ${themeClasses.statusBar}`}
      >
        {/* Left Stats */}
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto whitespace-nowrap">
          <span>
            {totalWords} {totalWords === 1 ? "palavra" : "palavras"}
          </span>
          <span className="opacity-40">•</span>
          <span>{totalChars} caracteres</span>
          <span className="opacity-40 hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            {totalLines} {totalLines === 1 ? "linha" : "linhas"}
          </span>
          <span className="opacity-40 hidden md:inline">•</span>
          <span className="hidden md:inline">~{readingTimeMin} min de leitura</span>
        </div>

        {/* Right Info */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0 whitespace-nowrap">
          <span className="hidden sm:inline">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span className="opacity-40 hidden sm:inline">•</span>
          <span className="hidden xs:inline">UTF-8</span>
          <span className="opacity-40 hidden xs:inline">•</span>
          <span className="text-blue-500 dark:text-blue-400 font-semibold cursor-pointer" onClick={onOpenExport}>
            Salvar em Formatos
          </span>
        </div>
      </footer>
    </div>
  );
};
