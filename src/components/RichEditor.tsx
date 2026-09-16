import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Link as LinkIcon,
  Unlink,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Table as TableIcon,
  Image as ImageIcon,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  RemoveFormatting,
  Palette,
  Highlighter,
  ChevronDown,
  Sparkles,
  Layers,
  Radio,
  Copy,
  Check,
  X,
  FileCode,
  PenTool,
  Maximize2,
  Minimize2,
  Columns,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Note, EditorFont, EditorTheme, EditorMode } from "../types";
import { InsertTableModal } from "./InsertTableModal";
import { InsertImageModal } from "./InsertImageModal";

interface RichEditorProps {
  note: Note | null;
  onUpdateNote: (fields: Partial<Note>) => void;
  font: EditorFont;
  theme: EditorTheme;
  remoteTypingDevice: string | null;
  onOpenExport: () => void;
}

// Helpers to preserve cursor position when content changes remotely
function getCaretCharacterOffsetWithin(element: HTMLElement): number {
  let caretOffset = 0;
  try {
    const doc = element.ownerDocument || document;
    const win = doc.defaultView || window;
    const sel = win.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      caretOffset = preCaretRange.toString().length;
    }
  } catch {
    // Ignore selection read errors
  }
  return caretOffset;
}

function setCaretPosition(element: HTMLElement, offset: number) {
  try {
    const doc = element.ownerDocument || document;
    const win = doc.defaultView || window;
    const sel = win.getSelection();
    if (!sel) return;

    let currentOffset = 0;
    const nodeStack: Node[] = [element];
    let node: Node | undefined;
    let found = false;

    const range = doc.createRange();
    range.setStart(element, 0);
    range.collapse(true);

    while (!found && (node = nodeStack.pop())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const textLen = node.textContent?.length || 0;
        if (currentOffset + textLen >= offset) {
          range.setStart(node, Math.min(offset - currentOffset, textLen));
          range.collapse(true);
          found = true;
        } else {
          currentOffset += textLen;
        }
      } else {
        let i = node.childNodes.length;
        while (i--) {
          nodeStack.push(node.childNodes[i]);
        }
      }
    }

    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // Graceful fallback if DOM tree shifted
  }
}

export const RichEditor: React.FC<RichEditorProps> = ({
  note,
  onUpdateNote,
  font,
  theme,
  remoteTypingDevice,
  onOpenExport,
}) => {
  const [editorMode, setEditorMode] = useState<EditorMode>(() => {
    return (localStorage.getItem("bloco_editor_mode") as EditorMode) || "rich";
  });
  const [pageViewMode, setPageViewMode] = useState<"page" | "fluid">(() => {
    return (localStorage.getItem("bloco_page_view_mode") as "page" | "fluid") || "page";
  });
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const [copied, setCopied] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [showHighlightPalette, setShowHighlightPalette] = useState(false);
  const [showHeadingDropdown, setShowHeadingDropdown] = useState(false);

  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");

  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    ul: false,
    ol: false,
    h1: false,
    h2: false,
    h3: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    alignJustify: false,
  });

  const contentEditableRef = useRef<HTMLDivElement>(null);
  const rawTextareaRef = useRef<HTMLTextAreaElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);

  // Sync modes
  useEffect(() => {
    localStorage.setItem("bloco_editor_mode", editorMode);
  }, [editorMode]);

  useEffect(() => {
    localStorage.setItem("bloco_page_view_mode", pageViewMode);
  }, [pageViewMode]);

  const lastEmittedHtmlRef = useRef<string>(note?.content || "");

  // Check active formatting for toolbar feedback
  const updateActiveFormats = useCallback(() => {
    if (editorMode !== "rich" || typeof document === "undefined" || !document.queryCommandState) return;
    try {
      const block = document.queryCommandValue("formatBlock").toLowerCase();
      setActiveFormats({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikethrough: document.queryCommandState("strikeThrough"),
        ul: document.queryCommandState("insertUnorderedList"),
        ol: document.queryCommandState("insertOrderedList"),
        h1: block === "h1",
        h2: block === "h2",
        h3: block === "h3",
        alignLeft: document.queryCommandState("justifyLeft"),
        alignCenter: document.queryCommandState("justifyCenter"),
        alignRight: document.queryCommandState("justifyRight"),
        alignJustify: document.queryCommandState("justifyFull"),
      });
    } catch {
      // Ignored for non-supported nodes
    }
  }, [editorMode]);

  // Sync note content to editable div when note ID changes or external update from other device/screen
  useEffect(() => {
    if (!note) return;
    const targetEl = contentEditableRef.current;
    if (!targetEl) return;

    const incomingHtml = note.content || "";

    // If incomingHtml matches what local user just typed, skip to avoid resetting cursor
    if (incomingHtml === lastEmittedHtmlRef.current && targetEl.innerHTML === incomingHtml) {
      return;
    }

    // External change from another device, screen, or note switch
    if (targetEl.innerHTML !== incomingHtml) {
      lastEmittedHtmlRef.current = incomingHtml;
      const isFocused = document.activeElement === targetEl;
      if (isFocused) {
        const offset = getCaretCharacterOffsetWithin(targetEl);
        targetEl.innerHTML = incomingHtml;
        setCaretPosition(targetEl, offset);
      } else {
        targetEl.innerHTML = incomingHtml;
      }
      updateActiveFormats();
    }
  }, [note?.id, note?.content, updateActiveFormats]);

  const handleEditableInput = () => {
    if (!contentEditableRef.current || !note) return;
    const html = contentEditableRef.current.innerHTML;
    lastEmittedHtmlRef.current = html;
    onUpdateNote({ content: html });
    updateActiveFormats();
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (editorMode !== "rich") return;
    contentEditableRef.current?.focus();
    document.execCommand(command, false, value);
    handleEditableInput();
    updateActiveFormats();
  };

  // Insert Table
  const handleInsertTable = (rows: number, cols: number, withHeader: boolean) => {
    contentEditableRef.current?.focus();
    let tableHtml = '<table class="docx-table"><tbody>';
    for (let r = 0; r < rows; r++) {
      tableHtml += "<tr>";
      for (let c = 0; c < cols; c++) {
        if (r === 0 && withHeader) {
          tableHtml += `<th>Cabeçalho ${c + 1}</th>`;
        } else {
          tableHtml += `<td>Item ${r},${c + 1}</td>`;
        }
      }
      tableHtml += "</tr>";
    }
    tableHtml += "</tbody></table><p><br></p>";
    document.execCommand("insertHTML", false, tableHtml);
    handleEditableInput();
  };

  // Insert Image
  const handleInsertImage = (src: string, alt: string) => {
    contentEditableRef.current?.focus();
    const imgHtml = `<img src="${src}" alt="${alt}" class="docx-embedded-img" /><p><br></p>`;
    document.execCommand("insertHTML", false, imgHtml);
    handleEditableInput();
  };

  // Insert Checklist Item
  const handleInsertChecklist = () => {
    contentEditableRef.current?.focus();
    const checkHtml = `
      <div class="checklist-item">
        <input type="checkbox" class="checklist-checkbox" />
        <span>Nova tarefa...</span>
      </div>
    `;
    document.execCommand("insertHTML", false, checkHtml);
    handleEditableInput();
  };

  // Color actions
  const handleSetTextColor = (color: string) => {
    executeCommand("foreColor", color);
    setShowColorPalette(false);
  };

  const handleSetHighlightColor = (color: string) => {
    executeCommand("hiliteColor", color);
    setShowHighlightPalette(false);
  };

  // Link Insertion Handler
  const handleOpenLinkModal = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
      const selectedText = sel.toString();
      setLinkText(selectedText);
    } else {
      savedSelectionRef.current = null;
      setLinkText("");
    }
    setLinkUrl("");
    setShowLinkModal(true);
  };

  const handleApplyLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;

    let validUrl = linkUrl.trim();
    if (!/^https?:\/\//i.test(validUrl) && !/^mailto:/i.test(validUrl)) {
      validUrl = "https://" + validUrl;
    }

    contentEditableRef.current?.focus();

    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current);
      }
    }

    if (linkText && savedSelectionRef.current && savedSelectionRef.current.collapsed) {
      document.execCommand(
        "insertHTML",
        false,
        `<a href="${validUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`
      );
    } else {
      document.execCommand("createLink", false, validUrl);
    }

    setShowLinkModal(false);
    setLinkUrl("");
    setLinkText("");
    handleEditableInput();
  };

  // Convert HTML to clean plain text for statistics
  const getPlainText = (html: string) => {
    if (typeof document === "undefined") return html || "";
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.innerText || tmp.textContent || "";
  };

  const handleCopyAll = async () => {
    if (!note) return;
    try {
      const plain = getPlainText(note.content || "");
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-neutral-400 bg-neutral-50/50 dark:bg-neutral-900/30">
        <div>
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-30 text-neutral-400" />
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Nenhum documento aberto
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Abra um arquivo DOCX/TXT na barra lateral ou crie um novo documento para editar.
          </p>
        </div>
      </div>
    );
  }

  const plainContent = getPlainText(note.content || "");
  const linesArray = plainContent.split("\n");
  const totalLines = linesArray.length;
  const totalChars = plainContent.length;
  const totalWords = (plainContent.trim().match(/\S+/g) || []).length;
  const readingTimeMin = Math.max(1, Math.ceil(totalWords / 200));
  const estimatedPages = Math.max(1, Math.ceil(totalWords / 450));

  // Determine font styling
  const fontClass =
    font === "mono"
      ? "font-mono text-[14px]"
      : font === "serif"
      ? "font-serif text-[16px]"
      : "font-sans text-[15px]";

  // Theme Classes
  const getThemeClasses = () => {
    switch (theme) {
      case "paper":
        return {
          workspace: "bg-[#ece9df] text-[#2c2825]",
          page: "bg-[#fdfcf9] text-[#2c2825] shadow-lg border border-[#dfdbcf]",
          toolbar: "bg-[#f5f3ec] border-b border-[#e4dfd2] text-[#524b45]",
          statusBar: "bg-[#f5f3ec] text-[#6d645b] border-t border-[#e4dfd2]",
          titleInput: "text-[#1f1c19] placeholder-[#8c827a] border-b border-[#e4dfd2]",
        };
      case "dark":
        return {
          workspace: "bg-neutral-950 text-neutral-100",
          page: "bg-neutral-900 text-neutral-100 shadow-xl border border-neutral-800",
          toolbar: "bg-neutral-900/90 border-b border-neutral-800 text-neutral-200",
          statusBar: "bg-neutral-900 text-neutral-400 border-t border-neutral-800",
          titleInput: "text-white placeholder-neutral-500 border-b border-neutral-800",
        };
      case "sepia":
        return {
          workspace: "bg-[#e5dac4] text-[#433422]",
          page: "bg-[#f7f1e1] text-[#433422] shadow-lg border border-[#dbcbb0]",
          toolbar: "bg-[#ebdcc0] border-b border-[#d8c3a1] text-[#5a462e]",
          statusBar: "bg-[#ebdcc0] text-[#786145] border-t border-[#d8c3a1]",
          titleInput: "text-[#322617] placeholder-[#8c7355] border-b border-[#d8c3a1]",
        };
      case "terminal":
        return {
          workspace: "bg-[#060a0f] text-[#38ef7d]",
          page: "bg-[#0b1219] text-[#38ef7d] shadow-xl border border-[#163321] font-mono",
          toolbar: "bg-[#080d13] border-b border-[#163321] text-[#2ba059]",
          statusBar: "bg-[#080d13] text-[#2ba059] border-t border-[#163321]",
          titleInput: "text-[#4dfa92] placeholder-[#1c693a] font-mono border-b border-[#163321]",
        };
      case "default":
      default:
        return {
          workspace: "bg-neutral-100/90 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100",
          page: "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-md border border-neutral-200/80 dark:border-neutral-800",
          toolbar: "bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200",
          statusBar: "bg-white dark:bg-neutral-900 text-neutral-500 border-t border-neutral-200 dark:border-neutral-800",
          titleInput: "text-neutral-900 dark:text-white placeholder-neutral-400 border-b border-neutral-200 dark:border-neutral-800",
        };
    }
  };

  const themeClasses = getThemeClasses();

  return (
    <div
      id="modern-word-editor-wrapper"
      className="flex-1 flex flex-col h-full overflow-hidden relative select-text"
    >
      {/* Remote typing sync banner */}
      {remoteTypingDevice && (
        <div
          id="remote-typing-banner"
          className="bg-blue-600 text-white text-xs px-4 py-1.5 flex items-center justify-between shrink-0 animate-in slide-in-from-top duration-150 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>
              <strong>{remoteTypingDevice}</strong> está editando este documento em tempo real...
            </span>
          </div>
          <span className="text-[10px] bg-blue-700/80 px-2.5 py-0.5 rounded-full font-medium">
            Sincronizado
          </span>
        </div>
      )}

      {/* Top Document Header & Mode Controls */}
      <div
        className={`px-5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${themeClasses.titleInput} bg-white dark:bg-neutral-900 shrink-0 shadow-2xs`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/50">
            <PenTool className="w-4 h-4" />
          </div>
          <input
            id="document-title-input"
            type="text"
            value={note.title || ""}
            onChange={(e) => onUpdateNote({ title: e.target.value })}
            placeholder="Título do Documento..."
            className="text-base sm:text-lg font-bold bg-transparent outline-none flex-1 min-w-0 text-neutral-900 dark:text-white tracking-tight"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs shrink-0">
          {/* Page view vs Full width switch */}
          <button
            type="button"
            onClick={() => setPageViewMode((prev) => (prev === "page" ? "fluid" : "page"))}
            title={pageViewMode === "page" ? "Alternar para Largura Total" : "Alternar para Modo Folha A4"}
            className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center gap-1 transition-colors"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {pageViewMode === "page" ? "Folha A4" : "Largura Total"}
            </span>
          </button>

          {/* Mode Switcher: Rico vs Código */}
          <div className="bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg flex items-center border border-neutral-200 dark:border-neutral-700">
            <button
              id="editor-mode-rich-btn"
              type="button"
              onClick={() => {
                setEditorMode("rich");
                if (contentEditableRef.current) {
                  contentEditableRef.current.innerHTML = note.content || "";
                }
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                editorMode === "rich"
                  ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <PenTool className="w-3 h-3" />
              <span>Editor</span>
            </button>
            <button
              id="editor-mode-plain-btn"
              type="button"
              onClick={() => setEditorMode("plain")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                editorMode === "plain"
                  ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <FileCode className="w-3 h-3" />
              <span>Código</span>
            </button>
          </div>

          <button
            id="copy-editor-content"
            type="button"
            onClick={handleCopyAll}
            title="Copiar texto formatado"
            className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center gap-1 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copiado!" : "Copiar"}</span>
          </button>

          <button
            id="editor-export-shortcut-btn"
            type="button"
            onClick={onOpenExport}
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Sparkles className="w-3 h-3" />
            <span>Salvar Como...</span>
          </button>
        </div>
      </div>

      {/* Modern Ribbon / Rich Formatting Toolbar */}
      {editorMode === "rich" && (
        <div
          id="modern-ribbon-toolbar"
          className={`px-3 py-1.5 flex items-center flex-wrap gap-1 text-xs select-none ${themeClasses.toolbar} border-b z-20`}
        >
          {/* Group 1: Undo / Redo */}
          <div className="flex items-center gap-0.5 pr-1.5 border-r border-neutral-300 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => executeCommand("undo")}
              title="Desfazer (Ctrl+Z)"
              className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand("redo")}
              title="Refazer (Ctrl+Y)"
              className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Group 2: Headings & Block Formats */}
          <div className="relative flex items-center gap-0.5 px-1.5 border-r border-neutral-300 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => setShowHeadingDropdown((prev) => !prev)}
              className="px-2 py-1 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 flex items-center gap-1 font-medium text-xs"
            >
              <span>
                {activeFormats.h1
                  ? "Título 1"
                  : activeFormats.h2
                  ? "Título 2"
                  : activeFormats.h3
                  ? "Título 3"
                  : "Parágrafo"}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showHeadingDropdown && (
              <div
                className="absolute top-full left-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl p-1.5 z-30 min-w-[140px] space-y-0.5"
                onClick={() => setShowHeadingDropdown(false)}
              >
                <button
                  type="button"
                  onClick={() => executeCommand("formatBlock", "<p>")}
                  className="w-full text-left px-2.5 py-1 rounded-lg text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                >
                  <span className="font-normal">Texto Normal</span>
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand("formatBlock", "<h1>")}
                  className="w-full text-left px-2.5 py-1 rounded-lg text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 font-bold text-neutral-900 dark:text-white"
                >
                  <Heading1 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Título 1</span>
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand("formatBlock", "<h2>")}
                  className="w-full text-left px-2.5 py-1 rounded-lg text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 font-semibold"
                >
                  <Heading2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Título 2</span>
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand("formatBlock", "<h3>")}
                  className="w-full text-left px-2.5 py-1 rounded-lg text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 font-medium"
                >
                  <Heading3 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Título 3</span>
                </button>
                <div className="h-px bg-neutral-200 dark:bg-neutral-800 my-1" />
                <button
                  type="button"
                  onClick={() => executeCommand("formatBlock", "<blockquote>")}
                  className="w-full text-left px-2.5 py-1 rounded-lg text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 italic"
                >
                  <Quote className="w-3.5 h-3.5 text-amber-500" />
                  <span>Citação</span>
                </button>
                <button
                  type="button"
                  onClick={() => executeCommand("formatBlock", "<pre>")}
                  className="w-full text-left px-2.5 py-1 rounded-lg text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 font-mono"
                >
                  <Code className="w-3.5 h-3.5 text-purple-500" />
                  <span>Código</span>
                </button>
              </div>
            )}
          </div>

          {/* Group 3: Font Styles (Bold, Italic, Underline, Strikethrough) */}
          <div className="flex items-center gap-0.5 px-1.5 border-r border-neutral-300 dark:border-neutral-700">
            <button
              id="format-bold-btn"
              type="button"
              onClick={() => executeCommand("bold")}
              title="Negrito (Ctrl+B)"
              className={`p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors ${
                activeFormats.bold ? "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold" : ""
              }`}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>

            <button
              id="format-italic-btn"
              type="button"
              onClick={() => executeCommand("italic")}
              title="Itálico (Ctrl+I)"
              className={`p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors ${
                activeFormats.italic ? "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400" : ""
              }`}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>

            <button
              id="format-underline-btn"
              type="button"
              onClick={() => executeCommand("underline")}
              title="Sublinhado (Ctrl+U)"
              className={`p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors ${
                activeFormats.underline ? "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400" : ""
              }`}
            >
              <Underline className="w-3.5 h-3.5" />
            </button>

            <button
              id="format-strikethrough-btn"
              type="button"
              onClick={() => executeCommand("strikeThrough")}
              title="Tachado / Riscado"
              className={`p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors ${
                activeFormats.strikethrough ? "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400" : ""
              }`}
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Group 4: Colors (Text Color & Highlight) */}
          <div className="relative flex items-center gap-0.5 px-1.5 border-r border-neutral-300 dark:border-neutral-700">
            {/* Text color button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowColorPalette((prev) => !prev);
                  setShowHighlightPalette(false);
                }}
                title="Cor do Texto"
                className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 flex items-center gap-0.5"
              >
                <Palette className="w-3.5 h-3.5 text-neutral-800 dark:text-neutral-200" />
                <div className="w-2.5 h-1 bg-blue-600 rounded-full" />
              </button>

              {showColorPalette && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl p-2 z-30 grid grid-cols-4 gap-1.5 w-36">
                  {[
                    { label: "Padrão", color: "#111827" },
                    { label: "Azul", color: "#2563eb" },
                    { label: "Verde", color: "#059669" },
                    { label: "Vermelho", color: "#dc2626" },
                    { label: "Roxo", color: "#7c3aed" },
                    { label: "Laranja", color: "#ea580c" },
                    { label: "Cinza", color: "#6b7280" },
                    { label: "Marrom", color: "#78350f" },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => handleSetTextColor(c.color)}
                      title={c.label}
                      className="w-6 h-6 rounded-full border border-neutral-300 dark:border-neutral-700 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c.color }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Highlighter button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowHighlightPalette((prev) => !prev);
                  setShowColorPalette(false);
                }}
                title="Cor de Realce (Marca-Texto)"
                className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 flex items-center gap-0.5"
              >
                <Highlighter className="w-3.5 h-3.5 text-amber-500" />
              </button>

              {showHighlightPalette && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl p-2 z-30 grid grid-cols-4 gap-1.5 w-36">
                  {[
                    { label: "Sem realce", color: "transparent" },
                    { label: "Amarelo", color: "#fef08a" },
                    { label: "Verde", color: "#bbf7d0" },
                    { label: "Azul", color: "#bae6fd" },
                    { label: "Rosa", color: "#fbcfe8" },
                    { label: "Laranja", color: "#fed7aa" },
                    { label: "Roxo", color: "#e9d5ff" },
                  ].map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => handleSetHighlightColor(c.color)}
                      title={c.label}
                      className="w-6 h-6 rounded-md border border-neutral-300 dark:border-neutral-700 hover:scale-110 transition-transform flex items-center justify-center text-[9px] font-bold"
                      style={{ backgroundColor: c.color }}
                    >
                      {c.color === "transparent" && "✕"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Group 5: Alignments (Left, Center, Right, Justify) */}
          <div className="flex items-center gap-0.5 px-1.5 border-r border-neutral-300 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => executeCommand("justifyLeft")}
              title="Alinhar à Esquerda"
              className={`p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors ${
                activeFormats.alignLeft ? "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400" : ""
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => executeCommand("justifyCenter")}
              title="Centralizar"
              className={`p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors ${
                activeFormats.alignCenter ? "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400" : ""
              }`}
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => executeCommand("justifyRight")}
              title="Alinhar à Direita"
              className={`p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors ${
                activeFormats.alignRight ? "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400" : ""
              }`}
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => executeCommand("justifyFull")}
              title="Justificar"
              className={`p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors ${
                activeFormats.alignJustify ? "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400" : ""
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Group 6: Lists (Bulleted, Numbered, Checklist) */}
          <div className="flex items-center gap-0.5 px-1.5 border-r border-neutral-300 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => executeCommand("insertUnorderedList")}
              title="Lista com Marcadores"
              className={`p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors ${
                activeFormats.ul ? "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400" : ""
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => executeCommand("insertOrderedList")}
              title="Lista Numerada"
              className={`p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors ${
                activeFormats.ol ? "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400" : ""
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleInsertChecklist}
              title="Lista de Tarefas (Checklist)"
              className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </button>
          </div>

          {/* Group 7: Rich Insertions (Table, Image, Link, Divider) */}
          <div className="flex items-center gap-0.5 px-1.5 border-r border-neutral-300 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => setShowTableModal(true)}
              title="Inserir Tabela Formatada"
              className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors text-blue-600 dark:text-blue-400"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowImageModal(true)}
              title="Inserir Imagem (Arquivo ou URL)"
              className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors text-purple-600 dark:text-purple-400"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleOpenLinkModal}
              title="Inserir Hiperlink (Ctrl+K)"
              className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors text-blue-600 dark:text-blue-400"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => executeCommand("insertHorizontalRule")}
              title="Inserir Linha Divisória"
              className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Group 8: Clear formatting */}
          <div className="flex items-center gap-0.5 pl-1.5">
            <button
              type="button"
              onClick={() => executeCommand("removeFormat")}
              title="Limpar Formatação da Seleção"
              className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <RemoveFormatting className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Document Canvas Workspace */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden ${themeClasses.workspace} p-3 sm:p-6 md:p-8 flex justify-center`}
      >
        {editorMode === "rich" ? (
          /* Modern Document Page Layout */
          <div
            className={`w-full transition-all duration-200 ${
              pageViewMode === "page"
                ? "max-w-4xl min-h-[90vh] rounded-xl sm:rounded-2xl p-6 sm:p-12 md:p-14 my-2"
                : "max-w-full min-h-full p-4 sm:p-6"
            } ${themeClasses.page}`}
            style={{
              zoom: zoomLevel !== 100 ? `${zoomLevel}%` : undefined,
            }}
          >
            <div
              ref={contentEditableRef}
              id="main-rich-editor-content"
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditableInput}
              onKeyUp={updateActiveFormats}
              onMouseUp={updateActiveFormats}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                  e.preventDefault();
                  handleOpenLinkModal();
                }
              }}
              data-placeholder="Comece a digitar seu texto aqui... Você pode colar ou abrir arquivos DOCX, formatar títulos, listas, tabelas e imagens."
              className={`document-content outline-none focus:outline-none min-h-[500px] select-text ${fontClass} [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-neutral-400 [&:empty]:before:pointer-events-none`}
            />
          </div>
        ) : (
          /* Plain Code / HTML Editor */
          <div className="w-full h-full max-w-5xl">
            <textarea
              ref={rawTextareaRef}
              id="main-plain-textarea"
              value={note.content || ""}
              onChange={(e) => onUpdateNote({ content: e.target.value })}
              placeholder="Modo texto puro / HTML fonte do documento..."
              className={`w-full h-full p-6 resize-none outline-none font-mono text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 shadow-sm`}
            />
          </div>
        )}
      </div>

      {/* Insert Link Modal */}
      {showLinkModal && (
        <div
          id="insert-link-dialog-backdrop"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowLinkModal(false)}
        >
          <div
            id="insert-link-dialog"
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    Inserir Hiperlink
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Insira um link web ou endereço de email
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyLink} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Endereço URL / Link:
                </label>
                <input
                  id="link-url-input"
                  type="text"
                  required
                  autoFocus
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://exemplo.com.br"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Texto de exibição (opcional):
                </label>
                <input
                  id="link-text-input"
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Ex: Clique aqui para acessar"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  id="confirm-insert-link-btn"
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Inserir Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Insert Table Modal */}
      <InsertTableModal
        isOpen={showTableModal}
        onClose={() => setShowTableModal(false)}
        onInsertTable={handleInsertTable}
      />

      {/* Insert Image Modal */}
      <InsertImageModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onInsertImage={handleInsertImage}
      />

      {/* Bottom Document Status Bar */}
      <footer
        id="editor-status-bar"
        className={`h-8 px-4 flex items-center justify-between text-[11px] select-none ${themeClasses.statusBar} border-t`}
      >
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto whitespace-nowrap text-neutral-600 dark:text-neutral-400">
          <span className="font-medium">
            {totalWords} {totalWords === 1 ? "palavra" : "palavras"}
          </span>
          <span className="opacity-40">•</span>
          <span>{totalChars} caracteres</span>
          <span className="opacity-40 hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            ~{estimatedPages} {estimatedPages === 1 ? "página A4" : "páginas A4"}
          </span>
          <span className="opacity-40 hidden md:inline">•</span>
          <span className="hidden md:inline">~{readingTimeMin} min de leitura</span>
        </div>

        <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center gap-1 text-neutral-500">
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.max(75, prev - 15))}
              title="Reduzir Zoom"
              className="p-1 hover:text-neutral-900 dark:hover:text-white"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] w-9 text-center font-mono">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.min(150, prev + 15))}
              title="Aumentar Zoom"
              className="p-1 hover:text-neutral-900 dark:hover:text-white"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          <span
            className="text-blue-600 dark:text-blue-400 font-semibold cursor-pointer hover:underline"
            onClick={onOpenExport}
          >
            Salvar em Formatos
          </span>
        </div>
      </footer>
    </div>
  );
};
