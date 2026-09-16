import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { Note, ExportFormatId, ExportFormatOption } from "../types";
import { exportHtmlToDocxBlob } from "./docxHandler";

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
    id: "txt",
    label: "Texto Simples (.txt)",
    extension: "txt",
    mimeType: "text/plain;charset=utf-8",
    category: "texto",
    description: "Arquivo de texto puro compatível com qualquer editor",
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
    id: "pdf",
    label: "Documento PDF (.pdf)",
    extension: "pdf",
    mimeType: "application/pdf",
    category: "documentos",
    description: "Documento formatado pronto para impressão e visualização universal",
  },
  {
    id: "docx",
    label: "Microsoft Word (.docx)",
    extension: "docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    category: "documentos",
    description: "Documento moderno do Microsoft Word com títulos e parágrafos",
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
    id: "bat",
    label: "Script Batch Windows (.bat)",
    extension: "bat",
    mimeType: "application/x-bat;charset=utf-8",
    category: "scripts",
    description: "Arquivo executável de lote para Prompt de Comando / Windows CMD",
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

export async function exportNote(note: Note, format: ExportFormatId): Promise<void> {
  const filename = `${sanitizeFilename(note.title)}.${format}`;
  const nowStr = new Date(note.updatedAt).toLocaleString("pt-BR");

  switch (format) {
    case "pdf": {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxLineWidth = pageWidth - margin * 2;

      // Header title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59);
      const titleLines = doc.splitTextToSize(note.title || "Sem título", maxLineWidth);
      doc.text(titleLines, margin, 25);

      let currentY = 25 + titleLines.length * 8;

      // Metadata line
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Atualizado em: ${nowStr} • Bloco de Notas Nuvem`, margin, currentY);

      currentY += 4;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY, pageWidth - margin, currentY);

      currentY += 10;

      // Content rendering with support for explicit A4 page breaks
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);

      const rawHtml = note.content || "";
      const pageChunks = rawHtml.split(
        /<div[^>]*class=["'][^"']*(?:a4-page-break|docx-page-break)[^"']*["'][^>]*>.*?<\/div>/gi
      );
      const lineHeight = 6;

      pageChunks.forEach((chunkHtml, chunkIdx) => {
        if (chunkIdx > 0) {
          doc.addPage();
          currentY = margin + 5;
        }

        const plain = htmlToPlainText(chunkHtml);
        const contentLines: string[] = doc.splitTextToSize(plain, maxLineWidth);

        for (let i = 0; i < contentLines.length; i++) {
          if (currentY + lineHeight > pageHeight - margin) {
            doc.addPage();
            currentY = margin + 5;
          }
          doc.text(contentLines[i], margin, currentY);
          currentY += lineHeight;
        }
      });

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Página ${p} de ${totalPages} • Salvo em Nuvem`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      }

      doc.save(filename);
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
