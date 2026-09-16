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
  FilePlus,
  Trash2,
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

// Helper functions for multi-page A4 document management
export function splitContentIntoPages(html: string): string[] {
  if (!html || html.trim() === "") return ["<p></p>"];
  const regex =
    /<div\s+class=["'][^"']*(?:a4-page-break|docx-page-break)[^"']*["'][^>]*>.*?<\/div>|<hr\s+class=["'][^"']*page-break[^"']*["']\s*\/?>/gi;
  const parts = html.split(regex);
  const cleaned = parts.map((p) => p.trim()).filter((p) => p.length > 0);
  return cleaned.length > 0 ? cleaned : [html];
}

export function joinPagesIntoContent(pages: string[]): string {
  return pages.join('<div class="a4-page-break" data-page-break="true"></div>');
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

  // Multi-page state for realistic A4 sheets
  const [pages, setPages] = useState<string[]>(() =>
    splitContentIntoPages(note?.content || "")
  );
  const pagesRef = useRef<string[]>(pages);
  pagesRef.current = pages;

  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const isPaginatingRef = useRef<boolean>(false);
  const paginationDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const triggerAutoPaginationCheckRef = useRef<((pageIndex: number) => void) | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fluidEditableRef = useRef<HTMLDivElement>(null);
  const rawTextareaRef = useRef<HTMLTextAreaElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);

  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // When note ID changes, re-split pages and reset active index
  useEffect(() => {
    if (!note) return;
    const newPages = splitContentIntoPages(note.content || "");
    setPages(newPages);
    pagesRef.current = newPages;
    lastEmittedHtmlRef.current = note.content || "";
    setActivePageIndex(0);

    const timer = setTimeout(() => {
      newPages.forEach((_, idx) => {
        triggerAutoPaginationCheckRef.current?.(idx);
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [note?.id]);

  // Sync note content from remote updates or external edits
  useEffect(() => {
    if (!note) return;
    const incomingHtml = note.content || "";
    if (incomingHtml === lastEmittedHtmlRef.current) return;

    lastEmittedHtmlRef.current = incomingHtml;
    const newPages = splitContentIntoPages(incomingHtml);
    setPages(newPages);

    if (pageViewMode === "fluid" && fluidEditableRef.current) {
      if (fluidEditableRef.current.innerHTML !== incomingHtml) {
        fluidEditableRef.current.innerHTML = incomingHtml;
      }
    } else {
      newPages.forEach((pgHtml, idx) => {
        const el = pageRefs.current[idx];
        if (el && el.innerHTML !== pgHtml) {
          el.innerHTML = pgHtml;
        }
      });
    }
    updateActiveFormats();
  }, [note?.content, pageViewMode, updateActiveFormats]);

  // Synchronize DOM elements when pages state updates
  useEffect(() => {
    if (pageViewMode === "page") {
      pages.forEach((pgHtml, idx) => {
        const el = pageRefs.current[idx];
        if (el && el.innerHTML !== pgHtml) {
          el.innerHTML = pgHtml;
        }
      });
    } else if (pageViewMode === "fluid" && fluidEditableRef.current && note) {
      if (fluidEditableRef.current.innerHTML !== (note.content || "")) {
        fluidEditableRef.current.innerHTML = note.content || "";
      }
    }
  }, [pages, pageViewMode, note?.id]);

  const getActiveEditableEl = useCallback((): HTMLDivElement | null => {
    if (pageViewMode === "fluid") {
      return fluidEditableRef.current;
    }
    return pageRefs.current[activePageIndex] || pageRefs.current[0] || null;
  }, [pageViewMode, activePageIndex]);

  const checkAndHandlePageOverflow = useCallback(
    (pageIndex: number, depth = 0) => {
      if (depth > 20) {
        isPaginatingRef.current = false;
        return;
      }
      if (pageViewMode !== "page") return;

      const el = pageRefs.current[pageIndex];
      if (!el) return;

      // Has content crossed the bottom margin of the page?
      // el.clientHeight is the visible height of the printable body.
      // A 2px threshold accounts for subpixel browser rounding.
      const isOverflowing = el.scrollHeight > el.clientHeight + 2;
      if (!isOverflowing) {
        isPaginatingRef.current = false;
        return;
      }

      isPaginatingRef.current = true;

      try {
        const containerRect = el.getBoundingClientRect();
        const children = Array.from(el.childNodes) as (HTMLElement | Text)[];
        if (children.length === 0) {
          isPaginatingRef.current = false;
          return;
        }

        // Find the first child that extends past the container's bottom margin
        let splitIndex = -1;
        for (let i = 0; i < children.length; i++) {
          const node = children[i];
          if (node.nodeType === Node.ELEMENT_NODE) {
            const rect = (node as HTMLElement).getBoundingClientRect();
            if (rect.bottom > containerRect.bottom - 2) {
              splitIndex = i;
              break;
            }
          }
        }

        // Fallback: check offsetTop + offsetHeight against clientHeight
        if (splitIndex === -1) {
          for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (node.nodeType === Node.ELEMENT_NODE) {
              const htmlEl = node as HTMLElement;
              if (htmlEl.offsetTop + htmlEl.offsetHeight > el.clientHeight - 2) {
                splitIndex = i;
                break;
              }
            }
          }
        }

        // If splitIndex wasn't found by coordinate, take the last element
        if (splitIndex === -1) {
          splitIndex = Math.max(0, children.length - 1);
        }

        let nodesToMove: Node[] = [];

        // If splitIndex === 0 and there's only 1 child, split the content of that single child!
        if (splitIndex === 0 && children.length === 1) {
          const singleNode = children[0];
          const text = singleNode.textContent || "";
          const words = text.split(/\s+/);
          if (words.length > 6) {
            const tag =
              singleNode.nodeType === Node.ELEMENT_NODE
                ? (singleNode as HTMLElement).tagName.toLowerCase()
                : "p";
            const keepEl = document.createElement(tag);
            const moveEl = document.createElement(tag);

            const splitWordCount = Math.max(3, Math.floor(words.length * 0.65));
            keepEl.textContent = words.slice(0, splitWordCount).join(" ");
            moveEl.textContent = words.slice(splitWordCount).join(" ");

            singleNode.parentNode?.replaceChild(keepEl, singleNode);
            nodesToMove = [moveEl];
          } else {
            nodesToMove = [singleNode];
          }
        } else {
          // If splitIndex === 0 but there are multiple children, keep at least child 0
          if (splitIndex === 0 && children.length > 1) {
            splitIndex = 1;
          }
          nodesToMove = children.slice(splitIndex);
        }

        if (nodesToMove.length === 0) {
          isPaginatingRef.current = false;
          return;
        }

        // Check if cursor was inside one of the moved nodes
        const sel = window.getSelection();
        let wasCursorInMoved = false;
        let savedOffset = 0;
        if (sel && sel.rangeCount > 0) {
          for (const mNode of nodesToMove) {
            if (mNode.contains(sel.anchorNode)) {
              wasCursorInMoved = true;
              if (mNode.nodeType === Node.ELEMENT_NODE) {
                savedOffset = getCaretCharacterOffsetWithin(mNode as HTMLElement);
              }
              break;
            }
          }
        }

        // Extract HTML for overflowing content
        const tempDiv = document.createElement("div");
        nodesToMove.forEach((node) => {
          tempDiv.appendChild(node.cloneNode(true));
        });
        const overflowHtml = tempDiv.innerHTML.trim();

        // Remove the moved nodes from the current page element
        nodesToMove.forEach((node) => {
          if (node.parentNode) {
            node.parentNode.removeChild(node);
          }
        });

        const remainingHtml = el.innerHTML.trim() || "<p></p>";
        const currentPages = [...pagesRef.current];
        currentPages[pageIndex] = remainingHtml;

        const nextPageIndex = pageIndex + 1;

        if (nextPageIndex < currentPages.length) {
          // Next page exists: prepend overflowing content to next page!
          const existingHtml = currentPages[nextPageIndex] || "";
          const isExistingBlank =
            !existingHtml ||
            existingHtml.trim() === "" ||
            existingHtml.trim() === "<p></p>" ||
            existingHtml.trim() === "<p><br></p>";

          currentPages[nextPageIndex] = isExistingBlank
            ? overflowHtml
            : overflowHtml + existingHtml;
        } else {
          // Next page does NOT exist: AUTOMATICALLY CREATE IT!
          currentPages.push(overflowHtml);
        }

        // Update pages state synchronously
        pagesRef.current = currentPages;
        setPages(currentPages);

        const combined = joinPagesIntoContent(currentPages);
        lastEmittedHtmlRef.current = combined;
        onUpdateNote({ content: combined });

        // Switch active page to nextPageIndex
        setActivePageIndex(nextPageIndex);

        // Seamlessly focus next page and restore cursor
        setTimeout(() => {
          const nextEl = pageRefs.current[nextPageIndex];
          if (nextEl) {
            nextEl.focus();
            if (wasCursorInMoved && savedOffset > 0) {
              setCaretPosition(nextEl, savedOffset);
            } else {
              const currentSel = window.getSelection();
              if (currentSel) {
                const range = document.createRange();
                range.selectNodeContents(nextEl);
                range.collapse(false);
                currentSel.removeAllRanges();
                currentSel.addRange(range);
              }
            }
            nextEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
          isPaginatingRef.current = false;

          // Cascade check: does the next page also overflow?
          checkAndHandlePageOverflow(nextPageIndex, depth + 1);
        }, 60);

      } catch (err) {
        console.error("Auto-pagination error:", err);
        isPaginatingRef.current = false;
      }
    },
    [onUpdateNote, pageViewMode]
  );

  const triggerAutoPaginationCheck = useCallback(
    (pageIndex: number) => {
      if (paginationDebounceRef.current) {
        clearTimeout(paginationDebounceRef.current);
      }
      paginationDebounceRef.current = setTimeout(() => {
        checkAndHandlePageOverflow(pageIndex);
      }, 50);
    },
    [checkAndHandlePageOverflow]
  );
  triggerAutoPaginationCheckRef.current = triggerAutoPaginationCheck;

  const handlePageInput = useCallback(
    (pageIndex: number) => {
      if (!note) return;
      if (pageViewMode === "fluid") {
        const el = fluidEditableRef.current;
        if (!el) return;
        const html = el.innerHTML;
        lastEmittedHtmlRef.current = html;
        onUpdateNote({ content: html });
        updateActiveFormats();
        return;
      }

      const el = pageRefs.current[pageIndex];
      if (!el) return;
      const newPageHtml = el.innerHTML;

      const next = [...pagesRef.current];
      next[pageIndex] = newPageHtml;
      const combined = joinPagesIntoContent(next);
      lastEmittedHtmlRef.current = combined;
      pagesRef.current = next;
      setPages(next);
      onUpdateNote({ content: combined });

      updateActiveFormats();

      // Automatically check and handle page overflow
      triggerAutoPaginationCheck(pageIndex);
    },
    [note, onUpdateNote, pageViewMode, triggerAutoPaginationCheck, updateActiveFormats]
  );

  const handlePagePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>, pageIndex: number) => {
      // Let browser paste into DOM, then trigger immediate pagination check
      setTimeout(() => {
        handlePageInput(pageIndex);
        triggerAutoPaginationCheck(pageIndex);
      }, 40);
    },
    [handlePageInput, triggerAutoPaginationCheck]
  );

  const handleAddPage = (afterIndex?: number) => {
    const currentPages = pagesRef.current;
    const targetIndex = afterIndex !== undefined ? afterIndex + 1 : currentPages.length;
    const nextPages = [...currentPages];
    nextPages.splice(targetIndex, 0, "<p></p>");
    pagesRef.current = nextPages;
    setPages(nextPages);

    const combined = joinPagesIntoContent(nextPages);
    lastEmittedHtmlRef.current = combined;
    onUpdateNote({ content: combined });

    setActivePageIndex(targetIndex);
    setTimeout(() => {
      const newEl = pageRefs.current[targetIndex];
      if (newEl) {
        newEl.focus();
        newEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 60);
  };

  const handleRemovePage = (pageIndex: number) => {
    const currentPages = pagesRef.current;
    if (currentPages.length <= 1) return;
    const nextPages = currentPages.filter((_, idx) => idx !== pageIndex);
    pagesRef.current = nextPages;
    setPages(nextPages);

    const combined = joinPagesIntoContent(nextPages);
    lastEmittedHtmlRef.current = combined;
    onUpdateNote({ content: combined });

    const nextActive = Math.max(0, pageIndex - 1);
    setActivePageIndex(nextActive);
    setTimeout(() => {
      pageRefs.current[nextActive]?.focus();
    }, 60);
  };

  const handleSplitPageAtCursorOrOverflow = (pageIndex: number) => {
    const el = pageRefs.current[pageIndex];
    if (!el) return;

    const sel = window.getSelection();
    let contentForNextPage = "<p></p>";

    // If cursor is within this page element, extract from cursor to end
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      try {
        const range = sel.getRangeAt(0);
        const afterRange = document.createRange();
        afterRange.setStart(range.endContainer, range.endOffset);
        afterRange.setEndAfter(el.lastChild || el);

        const extractedFragment = afterRange.extractContents();
        const tempDiv = document.createElement("div");
        tempDiv.appendChild(extractedFragment);
        contentForNextPage = tempDiv.innerHTML.trim() || "<p></p>";
      } catch {
        contentForNextPage = "<p></p>";
      }
    } else {
      // If no cursor: split at the bottom child elements
      const children = Array.from(el.children) as HTMLElement[];
      if (children.length > 1) {
        const splitIdx = Math.max(1, Math.floor(children.length / 2));
        const nextChildren = children.slice(splitIdx);
        const tempDiv = document.createElement("div");
        nextChildren.forEach((c) => {
          tempDiv.appendChild(c.cloneNode(true));
          c.remove();
        });
        contentForNextPage = tempDiv.innerHTML.trim() || "<p></p>";
      }
    }

    const remainingHtml = el.innerHTML.trim() || "<p></p>";
    const nextPages = [...pagesRef.current];
    nextPages[pageIndex] = remainingHtml;
    nextPages.splice(pageIndex + 1, 0, contentForNextPage);

    pagesRef.current = nextPages;
    setPages(nextPages);
    const combined = joinPagesIntoContent(nextPages);
    lastEmittedHtmlRef.current = combined;
    onUpdateNote({ content: combined });

    const nextIdx = pageIndex + 1;
    setActivePageIndex(nextIdx);
    setTimeout(() => {
      const nextEl = pageRefs.current[nextIdx];
      if (nextEl) {
        nextEl.focus();
        nextEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 60);
  };

  const handlePageKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    pageIndex: number
  ) => {
    // Ctrl + Enter or Cmd + Enter: manual page split
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSplitPageAtCursorOrOverflow(pageIndex);
      return;
    }

    // Enter key: check overflow immediately after new line
    if (e.key === "Enter") {
      setTimeout(() => {
        handlePageInput(pageIndex);
        triggerAutoPaginationCheck(pageIndex);
      }, 40);
    }

    // Ctrl + K: insert link
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      handleOpenLinkModal();
      return;
    }

    // Backspace at the start of a page: merge back or remove page
    if (e.key === "Backspace" && pageIndex > 0) {
      const el = pageRefs.current[pageIndex];
      const prevEl = pageRefs.current[pageIndex - 1];
      if (el) {
        const text = (el.textContent || "").trim();
        const sel = window.getSelection();
        const isAtStart =
          sel &&
          sel.rangeCount > 0 &&
          sel.isCollapsed &&
          (sel.anchorOffset === 0 || text === "");

        // If page is empty: delete page and focus previous
        if ((text === "" || el.children.length === 0) && pages.length > 1) {
          e.preventDefault();
          handleRemovePage(pageIndex);
          return;
        }

        // If at the start of page, merge first child back into previous page if space allows
        if (isAtStart && prevEl) {
          const firstChild = el.firstElementChild as HTMLElement | null;
          if (firstChild && prevEl.scrollHeight < prevEl.clientHeight - 20) {
            e.preventDefault();
            const movedHtml = firstChild.outerHTML;
            firstChild.remove();

            const remainingHtml = el.innerHTML.trim() || "<p></p>";
            const currentPages = [...pagesRef.current];
            currentPages[pageIndex - 1] = (currentPages[pageIndex - 1] || "") + movedHtml;

            if (el.children.length === 0 || remainingHtml === "<p></p>") {
              currentPages.splice(pageIndex, 1);
              setActivePageIndex(pageIndex - 1);
            } else {
              currentPages[pageIndex] = remainingHtml;
            }

            pagesRef.current = currentPages;
            setPages(currentPages);
            const combined = joinPagesIntoContent(currentPages);
            lastEmittedHtmlRef.current = combined;
            onUpdateNote({ content: combined });

            setTimeout(() => {
              const targetEl = pageRefs.current[pageIndex - 1];
              if (targetEl) {
                targetEl.focus();
                const range = document.createRange();
                range.selectNodeContents(targetEl);
                range.collapse(false);
                const currentSel = window.getSelection();
                if (currentSel) {
                  currentSel.removeAllRanges();
                  currentSel.addRange(range);
                }
              }
            }, 50);
            return;
          }
        }
      }
    }
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (editorMode !== "rich") return;
    const el = getActiveEditableEl();
    el?.focus();
    document.execCommand(command, false, value);
    if (pageViewMode === "fluid") {
      handlePageInput(0);
    } else {
      handlePageInput(activePageIndex);
    }
    updateActiveFormats();
  };

  // Insert Table
  const handleInsertTable = (rows: number, cols: number, withHeader: boolean) => {
    const el = getActiveEditableEl();
    el?.focus();
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
    if (pageViewMode === "fluid") {
      handlePageInput(0);
    } else {
      handlePageInput(activePageIndex);
    }
  };

  // Insert Image
  const handleInsertImage = (src: string, alt: string) => {
    const el = getActiveEditableEl();
    el?.focus();
    const imgHtml = `<img src="${src}" alt="${alt}" class="docx-embedded-img" /><p><br></p>`;
    document.execCommand("insertHTML", false, imgHtml);
    if (pageViewMode === "fluid") {
      handlePageInput(0);
    } else {
      handlePageInput(activePageIndex);
    }
  };

  // Insert Checklist Item
  const handleInsertChecklist = () => {
    const el = getActiveEditableEl();
    el?.focus();
    const checkHtml = `
      <div class="checklist-item">
        <input type="checkbox" class="checklist-checkbox" />
        <span>Nova tarefa...</span>
      </div>
    `;
    document.execCommand("insertHTML", false, checkHtml);
    if (pageViewMode === "fluid") {
      handlePageInput(0);
    } else {
      handlePageInput(activePageIndex);
    }
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

    const el = getActiveEditableEl();
    el?.focus();

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
    if (pageViewMode === "fluid") {
      handlePageInput(0);
    } else {
      handlePageInput(activePageIndex);
    }
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
        className={`px-3 sm:px-5 lg:px-6 2xl:px-8 py-2 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 ${themeClasses.titleInput} bg-white dark:bg-neutral-900 shrink-0 shadow-2xs`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/50">
            <PenTool className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <input
            id="document-title-input"
            type="text"
            value={note.title || ""}
            onChange={(e) => onUpdateNote({ title: e.target.value })}
            placeholder="Título do Documento..."
            className="text-sm sm:text-base md:text-lg font-bold bg-transparent outline-none flex-1 min-w-0 text-neutral-900 dark:text-white tracking-tight"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs shrink-0 flex-wrap sm:flex-nowrap">
          {/* Page view vs Full width switch */}
          <button
            type="button"
            onClick={() => setPageViewMode((prev) => (prev === "page" ? "fluid" : "page"))}
            title={pageViewMode === "page" ? "Alternar para Largura Total" : "Alternar para Modo Folha A4"}
            className="min-h-[30px] p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center gap-1 transition-colors"
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
                const newPages = splitContentIntoPages(note.content || "");
                setPages(newPages);
                setTimeout(() => {
                  if (pageViewMode === "fluid" && fluidEditableRef.current) {
                    fluidEditableRef.current.innerHTML = note.content || "";
                  } else {
                    newPages.forEach((pgHtml, idx) => {
                      if (pageRefs.current[idx]) {
                        pageRefs.current[idx]!.innerHTML = pgHtml;
                      }
                    });
                  }
                }, 10);
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
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
              className={`px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
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
            className="min-h-[30px] p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center gap-1 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copiado!" : "Copiar"}</span>
          </button>

          <button
            id="editor-export-shortcut-btn"
            type="button"
            onClick={onOpenExport}
            className="hidden sm:flex min-h-[30px] px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold items-center gap-1.5 transition-colors shadow-2xs"
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
          className={`px-2.5 sm:px-4 lg:px-6 2xl:px-8 py-1.5 flex items-center overflow-x-auto no-scrollbar gap-1 text-xs select-none ${themeClasses.toolbar} border-b z-20 shrink-0`}
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

          {/* Group 9: Multi-page A4 button */}
          <div className="flex items-center gap-0.5 pl-1.5 border-l border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => handleAddPage(activePageIndex)}
              title="Inserir Nova Folha A4 (Ctrl+Enter)"
              className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium text-xs"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-[11px]">Nova Folha</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Document Canvas Workspace */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden ${themeClasses.workspace} p-2 sm:p-5 md:p-8 lg:p-10 2xl:p-12 flex justify-center`}
      >
        {editorMode === "rich" ? (
          pageViewMode === "page" ? (
            /* Multi-Page A4 Sheet Canvas Layout */
            <div
              className="w-full flex flex-col items-center gap-6 sm:gap-8 py-2 sm:py-4"
              style={{
                zoom: zoomLevel !== 100 ? `${zoomLevel}%` : undefined,
              }}
            >
              {pages.map((pageHtml, idx) => (
                <React.Fragment key={idx}>
                  {/* Page Card */}
                  <div
                    id={`a4-page-card-${idx + 1}`}
                    onClick={() => setActivePageIndex(idx)}
                    className={`a4-page-sheet w-full max-w-[794px] h-[1123px] min-h-[1123px] max-h-[1123px] transition-shadow duration-200 rounded-lg sm:rounded-xl px-5 py-4 sm:px-12 sm:py-8 md:px-14 md:py-10 flex flex-col relative overflow-hidden ${
                      themeClasses.page
                    } ${
                      activePageIndex === idx
                        ? "ring-2 ring-blue-500/50 shadow-xl"
                        : "shadow-md hover:shadow-lg"
                    }`}
                    style={{
                      boxSizing: "border-box",
                    }}
                  >
                    {/* Page Top Header Bar */}
                    <div className="flex items-center justify-between pb-2 sm:pb-3 mb-2 border-b border-neutral-100 dark:border-neutral-800/80 text-[11px] text-neutral-400 select-none shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                          Folha {idx + 1}
                        </span>
                        <span>de {pages.length}</span>
                        <span className="text-neutral-300 dark:text-neutral-700 hidden sm:inline">•</span>
                        <span className="text-[10px] uppercase tracking-wider text-neutral-400 hidden sm:inline">
                          A4 (210 × 297 mm)
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {pages.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePage(idx);
                            }}
                            title="Remover esta folha A4"
                            className="p-1 rounded text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddPage(idx);
                          }}
                          title="Adicionar folha A4 após esta"
                          className="p-1 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-1"
                        >
                          <FilePlus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Page Editable Content Area */}
                    <div
                      ref={(el) => {
                        pageRefs.current[idx] = el;
                      }}
                      id={`page-editable-content-${idx + 1}`}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={() => handlePageInput(idx)}
                      onFocus={() => setActivePageIndex(idx)}
                      onKeyUp={updateActiveFormats}
                      onMouseUp={updateActiveFormats}
                      onKeyDown={(e) => handlePageKeyDown(e, idx)}
                      onPaste={(e) => handlePagePaste(e, idx)}
                      data-placeholder={
                        idx === 0
                          ? "Comece a digitar seu texto aqui... Você pode colar ou abrir arquivos DOCX, formatar títulos, listas, tabelas e imagens."
                          : `Continue seu texto na Folha A4 #${idx + 1}...`
                      }
                      className={`document-content flex-1 min-h-0 overflow-hidden outline-none focus:outline-none select-text ${fontClass} [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-neutral-400 [&:empty]:before:pointer-events-none`}
                    />

                    {/* Page Bottom Footer Bar */}
                    <div className="pt-2 mt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400 select-none shrink-0">
                      <span className="truncate max-w-[180px] sm:max-w-[300px]">
                        {note.title || "Documento sem título"}
                      </span>
                      <span className="font-mono">Página {idx + 1} de {pages.length}</span>
                    </div>
                  </div>

                  {/* Visual Page Break Separator between sheets */}
                  {idx < pages.length - 1 && (
                    <div className="w-full max-w-[794px] flex items-center justify-center gap-3 my-2 select-none opacity-80 hover:opacity-100 transition-opacity">
                      <div className="flex-1 h-px border-t border-dashed border-neutral-300 dark:border-neutral-700" />
                      <button
                        type="button"
                        onClick={() => handleAddPage(idx)}
                        className="px-3 py-1 rounded-full text-[11px] font-medium bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <FilePlus className="w-3 h-3" />
                        <span>Inserir Folha A4 Aqui</span>
                      </button>
                      <div className="flex-1 h-px border-t border-dashed border-neutral-300 dark:border-neutral-700" />
                    </div>
                  )}
                </React.Fragment>
              ))}

              {/* Bottom Add Page Button */}
              <div className="w-full max-w-[794px] flex justify-center pt-2 pb-8 select-none">
                <button
                  type="button"
                  id="add-new-a4-page-btn"
                  onClick={() => handleAddPage()}
                  className="px-5 py-2.5 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 text-neutral-600 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
                >
                  <FilePlus className="w-4 h-4" />
                  <span>+ Adicionar Nova Folha A4 (Página {pages.length + 1})</span>
                  <span className="text-[10px] text-neutral-400 font-mono hidden sm:inline ml-1">
                    (Ctrl+Enter)
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Fluid Full Width Layout */
            <div
              className={`w-full transition-all duration-200 max-w-full min-h-full p-3 sm:p-6 lg:p-8 ${themeClasses.page}`}
              style={{
                zoom: zoomLevel !== 100 ? `${zoomLevel}%` : undefined,
              }}
            >
              <div
                ref={fluidEditableRef}
                id="main-fluid-editor-content"
                contentEditable
                suppressContentEditableWarning
                onInput={() => handlePageInput(0)}
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
          )
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
          <span className="font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded">
            {pageViewMode === "page"
              ? `Folha ${activePageIndex + 1} de ${pages.length}`
              : "Largura Total Contínua"}
          </span>
          <span className="opacity-40">•</span>
          <span className="font-medium">
            {totalWords} {totalWords === 1 ? "palavra" : "palavras"}
          </span>
          <span className="opacity-40">•</span>
          <span>{totalChars} caracteres</span>
          <span className="opacity-40 hidden sm:inline">•</span>
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
