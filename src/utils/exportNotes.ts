import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { Note, ExportFormatId, ExportFormatOption } from "../types";
import { exportHtmlToDocxBlob } from "./docxHandler";
import { FONT_OPTIONS } from "../data/fonts";

// Helper to convert HTML content to formatted plain text for non-HTML formats
function htmlToPlainText(html: string): string {
  if (!html) return "";
  if (!html.includes("<") || !html.includes(">")) return html;
  
  // Replace line breaks, page breaks, and paragraph/list tags with newlines
  const formatted = html
    .replace(/<div[^>]*class=["'][^"']*(?:a4-page-break|docx-page-break)[^"']*["'][^>]*>.*?<\/div>/gi, "\n\n--- [ Quebra de Folha A4 ] ---\n\n")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/blockquote>/gi, "\n\n")
    .replace(/<hr\s*[\/]?>/gi, "\n---\n");

  if (typeof document !== "undefined") {
    const tmp = document.createElement("div");
    tmp.innerHTML = formatted;
    return (tmp.innerText || tmp.textContent || "").trim();
  }
  return formatted.replace(/<[^>]*>?/gm, "").trim();
}

export const EXPORT_FORMATS: ExportFormatOption[] = [
  {
    id: "pdf",
    label: "Documento PDF (.pdf)",
    extension: "pdf",
    mimeType: "application/pdf",
    category: "documentos",
    description: "Documento formatado pronto para impressão e visualização universal A4",
  },
  {
    id: "docx",
    label: "Microsoft Word (.docx)",
    extension: "docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    category: "documentos",
    description: "Documento moderno do Microsoft Word com títulos, listas e tabelas",
  },
  {
    id: "txt",
    label: "Texto Simples (.txt)",
    extension: "txt",
    mimeType: "text/plain;charset=utf-8",
    category: "texto",
    description: "Arquivo de texto puro compatível com qualquer editor",
  },
  {
    id: "doc",
    label: "Documento Word Clássico (.doc)",
    extension: "doc",
    mimeType: "application/msword",
    category: "documentos",
    description: "Compatível com versões legadas do Word e LibreOffice",
  },
  {
    id: "html",
    label: "Página Web (.html)",
    extension: "html",
    mimeType: "text/html;charset=utf-8",
    category: "documentos",
    description: "Página HTML5 independente com estilização e formatação elegante",
  },
  {
    id: "md",
    label: "Markdown (.md)",
    extension: "md",
    mimeType: "text/markdown;charset=utf-8",
    category: "texto",
    description: "Formatação leve para documentação e plataformas de desenvolvimento",
  },
  {
    id: "tft",
    label: "Formato TFT (.tft)",
    extension: "tft",
    mimeType: "text/plain;charset=utf-8",
    category: "texto",
    description: "Formato de texto / TFT especializado para terminais e anotações",
  },
  {
    id: "bat",
    label: "Script Batch Windows (.bat)",
    extension: "bat",
    mimeType: "application/x-bat;charset=utf-8",
    category: "scripts",
    description: "Arquivo executável de lote para Prompt de Comando / Windows CMD",
  },
  {
    id: "json",
    label: "Arquivo Estruturado (.json)",
    extension: "json",
    mimeType: "application/json;charset=utf-8",
    category: "dados",
    description: "Dados completos da nota em formato JSON com metadados",
  },
  {
    id: "sh",
    label: "Script Bash / Shell (.sh)",
    extension: "sh",
    mimeType: "application/x-sh;charset=utf-8",
    category: "scripts",
    description: "Script para terminais Linux, macOS e WSL",
  },
  {
    id: "py",
    label: "Script Python (.py)",
    extension: "py",
    mimeType: "text/x-python;charset=utf-8",
    category: "codigo",
    description: "Código fonte em Python",
  },
  {
    id: "js",
    label: "JavaScript (.js)",
    extension: "js",
    mimeType: "text/javascript;charset=utf-8",
    category: "codigo",
    description: "Código fonte em JavaScript",
  },
  {
    id: "rtf",
    label: "Rich Text Format (.rtf)",
    extension: "rtf",
    mimeType: "application/rtf;charset=utf-8",
    category: "documentos",
    description: "Texto rico com formatação padrão",
  },
  {
    id: "csv",
    label: "Planilha / CSV (.csv)",
    extension: "csv",
    mimeType: "text/csv;charset=utf-8",
    category: "dados",
    description: "Dados tabulados da nota em formato separado por vírgulas",
  },
];

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "nota";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Resolve CSS font-family string with comprehensive Unicode and Emoji fallbacks
function getFontFamilyCss(nameOrId?: string): string {
  const emojiFallbacks =
    "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', sans-serif";
  if (!nameOrId) {
    return `Calibri, Candara, 'Segoe UI', Arial, ${emojiFallbacks}`;
  }
  const matched = FONT_OPTIONS.find(
    (f) =>
      f.name.toLowerCase() === nameOrId.toLowerCase() ||
      f.id.toLowerCase() === nameOrId.toLowerCase()
  );
  if (matched) {
    return `${matched.fontFamily}, ${emojiFallbacks}`;
  }
  return `"${nameOrId}", 'Segoe UI', Roboto, Helvetica, Arial, ${emojiFallbacks}`;
}

// Convert raw plain text to formatted HTML paragraphs if note has no tags
function prepareHtmlContent(raw: string): string {
  if (!raw) return "<p></p>";
  if (
    raw.includes("<p") ||
    raw.includes("<div") ||
    raw.includes("<h1") ||
    raw.includes("<h2") ||
    raw.includes("<h3") ||
    raw.includes("<ul") ||
    raw.includes("<ol") ||
    raw.includes("<table") ||
    raw.includes("<br")
  ) {
    return raw;
  }
  return raw
    .split(/\n\n+/)
    .map(
      (paragraph) =>
        `<p style="margin-bottom: 10px;">${paragraph.replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
}

// Paginate HTML content across A4 pages based on explicit page breaks or height overflow
function paginateHtmlContent(rawHtml: string, maxPageHeight: number = 880): string[] {
  const prepared = prepareHtmlContent(rawHtml);

  // 1. Split by explicit A4 page break markers
  const pageBreakRegex =
    /<div\s+class=["'][^"']*(?:a4-page-break|docx-page-break)[^"']*["'][^>]*>.*?<\/div>|<hr\s+class=["'][^"']*page-break[^"']*["']\s*\/?>/gi;
  const initialChunks = prepared
    .split(pageBreakRegex)
    .map((c) => c.trim())
    .filter(Boolean);

  if (initialChunks.length === 0) return ["<p></p>"];

  if (typeof document === "undefined") return initialChunks;

  // 2. Measure if any chunk overflows A4 page height
  const staging = document.createElement("div");
  staging.style.position = "fixed";
  staging.style.top = "0";
  staging.style.left = "0";
  staging.style.width = "686px"; // 794px - 2 * 54px
  staging.style.visibility = "hidden";
  staging.style.pointerEvents = "none";
  staging.style.fontSize = "13pt";
  staging.style.lineHeight = "1.65";
  staging.style.wordBreak = "break-word";
  document.body.appendChild(staging);

  const finalPages: string[] = [];

  for (let idx = 0; idx < initialChunks.length; idx++) {
    const chunk = initialChunks[idx];
    staging.innerHTML = chunk;

    // Page 1 has title banner (~90px), subsequent pages have full printable height
    const limit = idx === 0 ? maxPageHeight - 90 : maxPageHeight;

    if (staging.scrollHeight <= limit) {
      finalPages.push(chunk);
      continue;
    }

    // Overflows: distribute child nodes across sub-pages
    const children = Array.from(staging.children) as HTMLElement[];
    if (children.length <= 1) {
      finalPages.push(chunk);
      continue;
    }

    let currentPageHtml = "";
    staging.innerHTML = "";

    for (const child of children) {
      const childHtml = child.outerHTML;
      staging.innerHTML = currentPageHtml + childHtml;

      const currentLimit = finalPages.length === 0 ? maxPageHeight - 90 : maxPageHeight;

      if (staging.scrollHeight > currentLimit && currentPageHtml.trim() !== "") {
        finalPages.push(currentPageHtml);
        currentPageHtml = childHtml;
        staging.innerHTML = childHtml;
      } else {
        currentPageHtml += childHtml;
      }
    }

    if (currentPageHtml.trim() !== "") {
      finalPages.push(currentPageHtml);
    }
  }

  staging.remove();
  return finalPages.length > 0 ? finalPages : initialChunks;
}

// Helper to clean and transliterate emojis/unicode symbols outside WinAnsi for jsPDF standard fonts
function sanitizeTextForJsPdf(text: string): string {
  if (!text) return "";

  // Replace common emojis with clean textual representations
  let cleaned = text
    .replace(/💾/g, "[Salvar]")
    .replace(/⚡/g, "[Auto]")
    .replace(/📄/g, "[Doc]")
    .replace(/🚀/g, "[Iniciar]")
    .replace(/📊/g, "[Dados]")
    .replace(/🔍/g, "[Busca]")
    .replace(/🔤/g, "[Fonte]")
    .replace(/📝/g, "[Nota]")
    .replace(/✅/g, "[OK]")
    .replace(/❌/g, "[X]")
    .replace(/⭐/g, "[*]")
    .replace(/💡/g, "[Dica]")
    .replace(/📌/g, "[Fixado]")
    .replace(/⚠️/g, "[Atenção]")
    .replace(/❤️/g, "<3>")
    .replace(/👍/g, "[+1]")
    .replace(/🌐/g, "[Web]")
    .replace(/🔒/g, "[Seguro]")
    .replace(/📱/g, "[Celular]")
    .replace(/💻/g, "[PC]")
    .replace(/📅/g, "[Data]")
    .replace(/⏰/g, "[Hora]")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/…/g, "...");

  // Remove surrogate pairs / non-WinAnsi emojis that cause corrupted bytes in standard jsPDF
  cleaned = cleaned.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "");

  return cleaned;
}

// 100% Reliable Direct Vector/Text PDF Generator using jsPDF - NEVER produces .txt
export async function exportNoteToPdfDirect(note: Note, filename: string): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 20;
  const contentWidth = pageWidth - margin * 2; // 170mm
  let cursorY = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - margin - 12) {
      doc.addPage();
      cursorY = margin;
      return true;
    }
    return false;
  };

  // Header: Document Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);

  const safeTitle = sanitizeTextForJsPdf(note.title || "Sem título");
  const titleLines = doc.splitTextToSize(safeTitle, contentWidth);
  doc.text(titleLines, margin, cursorY + 6);
  cursorY += titleLines.length * 8 + 4;

  // Metadata Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const nowStr = new Date(note.updatedAt).toLocaleString("pt-BR");
  doc.text(`Atualizado em: ${nowStr}   •   Bloco de Notas Nuvem`, margin, cursorY);
  cursorY += 4;

  // Header Separator Line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 8;

  // Parse HTML elements into structured blocks
  const rawHtml = note.content || "";
  const blocks: { type: "h1" | "h2" | "h3" | "p" | "li" | "quote" | "table" | "hr"; text: string }[] = [];

  if (typeof document !== "undefined") {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = prepareHtmlContent(rawHtml);

    const traverse = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (tag === "h1") {
          const t = sanitizeTextForJsPdf(el.innerText || el.textContent || "").trim();
          if (t) blocks.push({ type: "h1", text: t });
        } else if (tag === "h2") {
          const t = sanitizeTextForJsPdf(el.innerText || el.textContent || "").trim();
          if (t) blocks.push({ type: "h2", text: t });
        } else if (tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
          const t = sanitizeTextForJsPdf(el.innerText || el.textContent || "").trim();
          if (t) blocks.push({ type: "h3", text: t });
        } else if (tag === "li") {
          const t = sanitizeTextForJsPdf(el.innerText || el.textContent || "").trim();
          if (t) blocks.push({ type: "li", text: t });
        } else if (tag === "blockquote") {
          const t = sanitizeTextForJsPdf(el.innerText || el.textContent || "").trim();
          if (t) blocks.push({ type: "quote", text: t });
        } else if (tag === "hr") {
          blocks.push({ type: "hr", text: "" });
        } else if (tag === "p" || tag === "div") {
          // If it only contains child block elements, traverse them
          if (el.querySelector("p, div, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote")) {
            for (const child of Array.from(node.childNodes)) {
              traverse(child);
            }
          } else {
            const t = sanitizeTextForJsPdf(el.innerText || el.textContent || "").trim();
            if (t) blocks.push({ type: "p", text: t });
          }
        } else if (tag === "table") {
          const rows = Array.from(el.querySelectorAll("tr"));
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll("th, td")).map((c) =>
              sanitizeTextForJsPdf(c.textContent || "").trim()
            );
            if (cells.length > 0) {
              blocks.push({ type: "table", text: cells.join("   |   ") });
            }
          }
        } else {
          for (const child of Array.from(node.childNodes)) {
            traverse(child);
          }
        }
      }
    };

    for (const child of Array.from(tempDiv.childNodes)) {
      traverse(child);
    }
  }

  if (blocks.length === 0) {
    const plain = sanitizeTextForJsPdf(htmlToPlainText(rawHtml));
    const lines = plain.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      blocks.push({ type: "p", text: line });
    }
  }

  for (const block of blocks) {
    if (block.type === "h1") {
      checkPageBreak(15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      const lines = doc.splitTextToSize(block.text, contentWidth);
      cursorY += 4;
      doc.text(lines, margin, cursorY);
      cursorY += lines.length * 6 + 2;
    } else if (block.type === "h2") {
      checkPageBreak(13);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      const lines = doc.splitTextToSize(block.text, contentWidth);
      cursorY += 3;
      doc.text(lines, margin, cursorY);
      cursorY += lines.length * 5.5 + 2;
    } else if (block.type === "h3") {
      checkPageBreak(11);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      const lines = doc.splitTextToSize(block.text, contentWidth);
      cursorY += 2;
      doc.text(lines, margin, cursorY);
      cursorY += lines.length * 5 + 1.5;
    } else if (block.type === "li") {
      checkPageBreak(8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      const lines = doc.splitTextToSize(block.text, contentWidth - 8);
      doc.text("•", margin + 2, cursorY + 4);
      doc.text(lines, margin + 8, cursorY + 4);
      cursorY += lines.length * 5 + 1.5;
    } else if (block.type === "quote") {
      checkPageBreak(10);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const lines = doc.splitTextToSize(block.text, contentWidth - 10);
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.8);
      doc.line(margin + 2, cursorY, margin + 2, cursorY + lines.length * 5 + 2);
      doc.text(lines, margin + 8, cursorY + 4);
      cursorY += lines.length * 5 + 3;
    } else if (block.type === "table") {
      checkPageBreak(9);
      doc.setFont("courier", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const lines = doc.splitTextToSize(block.text, contentWidth);
      doc.text(lines, margin, cursorY + 3.5);
      cursorY += lines.length * 4.5 + 1.5;
    } else if (block.type === "hr") {
      checkPageBreak(6);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      cursorY += 3;
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 4;
    } else {
      checkPageBreak(8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      const lines = doc.splitTextToSize(block.text, contentWidth);
      doc.text(lines, margin, cursorY + 4);
      cursorY += lines.length * 5.2 + 2.5;
    }
  }

  // Page Numbers Footer on all pages
  const totalDocPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalDocPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.text(
      `Página ${i} de ${totalDocPages}   •   Bloco de Notas Nuvem`,
      pageWidth / 2,
      pageHeight - 7,
      { align: "center" }
    );
  }

  doc.save(filename);
}

// High-fidelity A4 PDF export using DOM-to-Canvas rendering with full formatting, unicode, and emojis
export async function exportNoteToPdfHighFidelity(
  note: Note,
  filename: string
): Promise<void> {
  const nowStr = new Date(note.updatedAt).toLocaleString("pt-BR");
  const fontFamilyCss = getFontFamilyCss(note.fontFamily);
  const fontSizeCss = note.fontSize ? `${note.fontSize}pt` : "12pt";

  // Paginate the content into A4 pages
  const pageChunks = paginateHtmlContent(note.content || "");
  const totalPages = pageChunks.length;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Staging container for high-res HTML rendering - positioned offscreen in standard layout flow
  const stagingContainer = document.createElement("div");
  stagingContainer.id = "pdf-export-staging-container";
  stagingContainer.style.position = "absolute";
  stagingContainer.style.left = "-9999px";
  stagingContainer.style.top = "0";
  stagingContainer.style.width = "794px";
  stagingContainer.style.height = "auto";
  stagingContainer.style.opacity = "1";
  stagingContainer.style.visibility = "visible";
  stagingContainer.style.pointerEvents = "none";
  stagingContainer.style.backgroundColor = "#ffffff";
  document.body.appendChild(stagingContainer);

  try {
    for (let p = 0; p < totalPages; p++) {
      const isFirstPage = p === 0;
      const pageHtml = pageChunks[p];

      stagingContainer.innerHTML = `
        <style>
          .pdf-export-sheet {
            width: 794px;
            height: 1123px;
            min-height: 1123px;
            max-height: 1123px;
            box-sizing: border-box;
            padding: 48px 54px 38px 54px;
            background-color: #ffffff !important;
            color: #1e293b !important;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            font-family: ${fontFamilyCss};
            font-size: ${fontSizeCss};
            line-height: 1.65;
            overflow: hidden;
            position: relative;
            letter-spacing: normal;
          }
          .pdf-export-sheet * {
            box-sizing: border-box;
          }
          .pdf-export-content {
            flex: 1;
            overflow: hidden;
            color: #1e293b;
            word-break: break-word;
            font-family: inherit;
          }
          .pdf-export-content p {
            margin: 0 0 8px 0;
            min-height: 1.2em;
            line-height: 1.65;
          }
          .pdf-export-content h1 {
            font-size: 22px;
            font-weight: 700;
            color: #0f172a;
            margin: 14px 0 6px 0;
            line-height: 1.3;
          }
          .pdf-export-content h2 {
            font-size: 18px;
            font-weight: 600;
            color: #1e293b;
            margin: 12px 0 5px 0;
            line-height: 1.35;
          }
          .pdf-export-content h3 {
            font-size: 15px;
            font-weight: 600;
            color: #334155;
            margin: 10px 0 4px 0;
            line-height: 1.4;
          }
          .pdf-export-content ul {
            list-style-type: disc;
            margin: 6px 0 8px 0;
            padding-left: 24px;
          }
          .pdf-export-content ol {
            list-style-type: decimal;
            margin: 6px 0 8px 0;
            padding-left: 24px;
          }
          .pdf-export-content li {
            margin-bottom: 4px;
            line-height: 1.6;
          }
          .pdf-export-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
            border: 1px solid #cbd5e1;
          }
          .pdf-export-content th,
          .pdf-export-content td {
            border: 1px solid #cbd5e1;
            padding: 6px 10px;
            font-size: 12px;
          }
          .pdf-export-content th {
            background-color: #f8fafc;
            font-weight: 600;
          }
          .pdf-export-content blockquote {
            border-left: 3px solid #3b82f6;
            padding-left: 12px;
            margin: 10px 0;
            color: #475569;
            font-style: italic;
          }
          .pdf-export-content pre,
          .pdf-export-content code {
            background-color: #f1f5f9;
            font-family: monospace;
            padding: 2px 5px;
            border-radius: 4px;
            font-size: 12px;
          }
          .pdf-export-content img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            margin: 6px 0;
          }
          .pdf-export-content hr {
            border: none;
            border-top: 1px solid #e2e8f0;
            margin: 10px 0;
          }
          .pdf-export-content mark {
            background-color: #fef08a;
            padding: 1px 3px;
            border-radius: 2px;
          }
          .pdf-export-content input[type="checkbox"] {
            margin-right: 6px;
            vertical-align: middle;
          }
        </style>

        <div class="pdf-export-sheet">
          ${
            isFirstPage
              ? `
            <!-- Document Title & Header Banner -->
            <div style="margin-bottom: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; flex-shrink: 0;">
              <h1 style="font-size: 26px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0; line-height: 1.25; font-family: inherit;">
                ${escapeXml(note.title || "Sem título")}
              </h1>
              <div style="font-size: 11px; color: #64748b; display: flex; align-items: center; gap: 8px;">
                <span>Atualizado em: ${nowStr}</span>
                <span>•</span>
                <span>Bloco de Notas Nuvem</span>
              </div>
            </div>
          `
              : `
            <!-- Running Header on subsequent pages -->
            <div style="margin-bottom: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #94a3b8; flex-shrink: 0;">
              <span style="font-weight: 500; color: #64748b; font-family: inherit;">${escapeXml(note.title || "Documento")}</span>
              <span>Folha ${p + 1} de ${totalPages}</span>
            </div>
          `
          }

          <!-- Page Body Content with Full Rich Formatting & Emojis -->
          <div class="pdf-export-content">
            ${pageHtml}
          </div>

          <!-- Page Footer -->
          <div style="margin-top: auto; padding-top: 10px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8; flex-shrink: 0;">
            <span>Página ${p + 1} de ${totalPages}</span>
            <span>Salvo em Nuvem</span>
          </div>
        </div>
      `;

      // Allow fonts, emojis, and DOM layout to settle
      await new Promise((r) => setTimeout(r, 60));

      const sheetElement = stagingContainer.querySelector(".pdf-export-sheet") as HTMLElement;
      if (!sheetElement) continue;

      const canvas = await html2canvas(sheetElement, {
        scale: 2, // High resolution (300 DPI equivalent) for sharp text & graphics
        useCORS: true,
        allowTaint: false, // CRITICAL: NEVER TAINT CANVAS
        backgroundColor: "#ffffff",
        logging: false,
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      if (p > 0) {
        doc.addPage("a4", "portrait");
      }

      // Add high-res image exactly fitting A4 page (210mm x 297mm)
      doc.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }

    doc.save(filename);
  } catch (err) {
    console.error("Aviso no renderizador canvas do PDF, ativando gerador estruturado direto de PDF:", err);
    // 100% RELIABLE FALLBACK: ALWAYS PRODUCES A REAL, HIGH-QUALITY .PDF FILE! NEVER .TXT!
    await exportNoteToPdfDirect(note, filename);
  } finally {
    stagingContainer.remove();
  }
}

export async function exportNote(note: Note, format: ExportFormatId): Promise<void> {
  const filename = `${sanitizeFilename(note.title)}.${format}`;
  const nowStr = new Date(note.updatedAt).toLocaleString("pt-BR");

  switch (format) {
    case "pdf": {
      await exportNoteToPdfHighFidelity(note, filename);
      break;
    }

    case "docx": {
      try {
        const blob = await exportHtmlToDocxBlob(note.title || "Sem título", note.content || "");
        triggerDownload(blob, filename);
      } catch (err) {
        console.error("Erro ao gerar docx estruturado, usando fallback simples:", err);
        // Fallback simple document
        const fallbackDoc = new Document({
          sections: [
            {
              children: [
                new Paragraph({
                  text: note.title || "Sem título",
                  heading: HeadingLevel.TITLE,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: htmlToPlainText(note.content || ""),
                      size: 22,
                    }),
                  ],
                }),
              ],
            },
          ],
        });
        const fallbackBlob = await Packer.toBlob(fallbackDoc);
        triggerDownload(fallbackBlob, filename);
      }
      break;
    }

    case "doc": {
      // Legacy Microsoft Word format via formatted HTML MIME encapsulation
      const htmlDoc = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>${escapeXml(note.title)}</title>
          <style>
            body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1e293b; }
            h1 { font-size: 18pt; color: #0f172a; margin-bottom: 4px; }
            .meta { font-size: 9pt; color: #64748b; margin-bottom: 20px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; }
            p { margin-bottom: 8px; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>${escapeXml(note.title || "Sem título")}</h1>
          <div class="meta">Atualizado em: ${nowStr} • Bloco de Notas Nuvem</div>
          <p>${escapeXml(note.content || "")}</p>
        </body>
        </html>
      `;
      const blob = new Blob(["\ufeff" + htmlDoc], { type: "application/msword;charset=utf-8" });
      triggerDownload(blob, filename);
      break;
    }

    case "bat": {
      // Windows batch script with CRLF endings
      const crlfContent = (note.content || "").replace(/\r?\n/g, "\r\n");
      const blob = new Blob([crlfContent], { type: "application/x-bat;charset=utf-8" });
      triggerDownload(blob, filename);
      break;
    }

    case "html": {
      const htmlPage = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(note.title || "Nota")}</title>
  <style>
    :root {
      color-scheme: light dark;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 40px 20px;
      background: #f8fafc;
      color: #1e293b;
      display: flex;
      justify-content: center;
    }
    .container {
      max-width: 800px;
      width: 100%;
      background: #ffffff;
      padding: 48px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      border: 1px solid #e2e8f0;
    }
    h1 {
      margin: 0 0 12px 0;
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
    }
    .meta {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    .content {
      font-size: 16px;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: inherit;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #0f172a; color: #f1f5f9; }
      .container { background: #1e293b; border-color: #334155; }
      h1 { color: #f8fafc; }
      .meta { color: #94a3b8; border-color: #334155; }
    }
    @media print {
      body { background: #fff; padding: 0; }
      .container { box-shadow: none; border: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeXml(note.title || "Sem título")}</h1>
    <div class="meta">Última atualização: ${nowStr} • Salvo na Nuvem</div>
    <div class="content">${escapeXml(note.content || "")}</div>
  </div>
</body>
</html>`;
      const blob = new Blob([htmlPage], { type: "text/html;charset=utf-8" });
      triggerDownload(blob, filename);
      break;
    }

    case "md": {
      const mdContent = `# ${note.title || "Sem título"}\n\n*Última atualização: ${nowStr}*\n\n---\n\n${note.content || ""}`;
      const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
      triggerDownload(blob, filename);
      break;
    }

    case "json": {
      const jsonObject = {
        title: note.title,
        content: note.content,
        tags: note.tags,
        pinned: note.pinned,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        version: note.version,
        stats: {
          characters: note.content.length,
          words: (note.content.trim().match(/\S+/g) || []).length,
          lines: note.content.split("\n").length,
        },
      };
      const blob = new Blob([JSON.stringify(jsonObject, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      triggerDownload(blob, filename);
      break;
    }

    case "rtf": {
      // Escape for RTF
      const escapedRtfText = (note.content || "")
        .replace(/\\/g, "\\\\")
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}")
        .replace(/\n/g, "\\par\n");

      const rtf = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0 Arial;}}
{\\colortbl;\\red30\\green41\\blue59;\\red100\\green116\\blue139;}
\\f0\\fs32\\b ${escapeRtf(note.title || "Sem título")}\\b0\\fs20\\par
\\cf2 Atualizado em: ${nowStr} • Bloco de Notas Nuvem\\cf1\\par\\par
\\fs24 ${escapedRtfText}
}`;
      const blob = new Blob([rtf], { type: "application/rtf;charset=utf-8" });
      triggerDownload(blob, filename);
      break;
    }

    case "csv": {
      const csvRows = [
        ["Campo", "Valor"],
        ["Título", `"${(note.title || "").replace(/"/g, '""')}"`],
        ["Atualizado", `"${nowStr}"`],
        ["Tags", `"${(note.tags || []).join(", ").replace(/"/g, '""')}"`],
        ["Conteúdo", `"${(note.content || "").replace(/"/g, '""')}"`],
      ];
      const csvContent = csvRows.map((r) => r.join(";")).join("\r\n");
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
      triggerDownload(blob, filename);
      break;
    }

    case "sh": {
      const shContent = `#!/usr/bin/env bash\n# ${note.title}\n# Criado com Bloco de Notas Nuvem\n\n${(note.content || "").replace(/\r\n/g, "\n")}`;
      const blob = new Blob([shContent], { type: "application/x-sh;charset=utf-8" });
      triggerDownload(blob, filename);
      break;
    }

    case "py": {
      const pyContent = `"""\n${note.title}\nAtualizado em: ${nowStr}\n"""\n\n${note.content || ""}`;
      const blob = new Blob([pyContent], { type: "text/x-python;charset=utf-8" });
      triggerDownload(blob, filename);
      break;
    }

    case "js": {
      const jsContent = `/**\n * ${note.title}\n * Atualizado em: ${nowStr}\n */\n\n${note.content || ""}`;
      const blob = new Blob([jsContent], { type: "text/javascript;charset=utf-8" });
      triggerDownload(blob, filename);
      break;
    }

    case "tft":
    case "txt":
    default: {
      // Plain text or TFT format
      const plain = htmlToPlainText(note.content || "");
      const blob = new Blob([plain], { type: "text/plain;charset=utf-8" });
      triggerDownload(blob, filename);
      break;
    }
  }
}

function escapeXml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeRtf(str: string): string {
  return (str || "")
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}");
}
