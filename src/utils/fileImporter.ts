import { parseDocxToHtml, sanitizeDocxHtml } from "./docxHandler";
import mammoth from "mammoth";

export interface ParsedImportedFile {
  title: string;
  content: string;
  format: string;
  size: number;
}

/**
 * Extracts clean readable text from legacy binary .doc files
 */
function extractTextFromBinaryDoc(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let text = "";
  // Check if it's RTF disguised as .doc
  const header = String.fromCharCode(...bytes.slice(0, 10));
  if (header.includes("{\\rtf")) {
    const rawRtf = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return rawRtf
      .replace(/\\par[d]?/g, "\n")
      .replace(/\\[a-z0-9-]+/gi, " ")
      .replace(/[{}]/g, "")
      .replace(/\n\s*\n/g, "\n\n")
      .trim();
  }

  // Scan ASCII / UTF-8 printable strings in binary stream
  let currentWord = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b >= 160) {
      currentWord += String.fromCharCode(b);
    } else {
      if (currentWord.length >= 3) {
        text += currentWord + " ";
      }
      currentWord = "";
    }
  }
  if (currentWord.length >= 3) {
    text += currentWord;
  }

  const cleaned = text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "Conteúdo do documento Word binário (.doc). Recomendamos salvar em formato .docx para obter formatação completa.";
}

/**
 * Parses any supported text document:
 * .txt, .docx, .doc, .html, .md, .rtf, .json, .csv, .bat, .sh, .py, .js, .log, etc.
 */
export async function parseImportedFile(file: File): Promise<ParsedImportedFile> {
  const filename = file.name;
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const title = filename.replace(/\.[^/.]+$/, "");

  // 1. DOCX (Modern Word format with rich formatting, headings, tables and images)
  if (ext === "docx") {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { html } = await parseDocxToHtml(arrayBuffer);
      return {
        title,
        content: html || "<p></p>",
        format: "DOCX",
        size: file.size,
      };
    } catch (err) {
      console.warn("Erro ao processar arquivo .docx com parser avançado, tentando fallback:", err);
      // Fallback text extraction
      const arrayBuffer = await file.arrayBuffer();
      const fallbackText = extractTextFromBinaryDoc(arrayBuffer);
      return {
        title,
        content: `<p>${fallbackText}</p>`,
        format: "DOCX",
        size: file.size,
      };
    }
  }

  // 2. DOC (Legacy Word format)
  if (ext === "doc") {
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Test if it's actually an OpenXML docx with .doc extension
      try {
        const { html } = await parseDocxToHtml(arrayBuffer);
        if (html && html.trim().length > 15) {
          return {
            title,
            content: html,
            format: "DOC",
            size: file.size,
          };
        }
      } catch {
        // Continue to binary extractor
      }

      const extracted = extractTextFromBinaryDoc(arrayBuffer);
      const paragraphs = extracted
        .split("\n\n")
        .filter((p) => p.trim())
        .map((p) => `<p>${p.trim()}</p>`)
        .join("");

      return {
        title,
        content: paragraphs || `<p>${extracted}</p>`,
        format: "DOC",
        size: file.size,
      };
    } catch (err) {
      console.error("Erro ao ler arquivo .doc:", err);
      return {
        title,
        content: "<p>Não foi possível processar o arquivo .doc selecionado.</p>",
        format: "DOC",
        size: file.size,
      };
    }
  }

  // 3. RTF (Rich Text Format)
  if (ext === "rtf") {
    const rawText = await file.text();
    const cleanText = rawText
      .replace(/\\par[d]?/g, "\n")
      .replace(/\\[a-z0-9-]+/gi, " ")
      .replace(/[{}]/g, "")
      .replace(/\n\s*\n/g, "\n\n")
      .trim();

    const paragraphs = cleanText
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => `<p>${line.trim()}</p>`)
      .join("");

    return {
      title,
      content: paragraphs || `<p>${cleanText}</p>`,
      format: "RTF",
      size: file.size,
    };
  }

  // 4. HTML / HTM
  if (ext === "html" || ext === "htm") {
    const htmlText = await file.text();
    // If full HTML document, extract body
    let bodyContent = htmlText;
    const bodyMatch = htmlText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      bodyContent = bodyMatch[1];
    }
    return {
      title,
      content: bodyContent,
      format: "HTML",
      size: file.size,
    };
  }

  // 5. Standard Text / Code / Script / Markdown
  // (.txt, .md, .bat, .cmd, .sh, .json, .csv, .py, .js, .ts, .log, .yaml, .xml, etc.)
  const textContent = await file.text();

  // If Markdown, convert simple headings and lists or wrap in paragraphs
  if (ext === "md" || ext === "markdown") {
    const formatted = textContent
      .split("\n")
      .map((line) => {
        if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
        if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
        if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
        if (line.startsWith("- ") || line.startsWith("* ")) return `<li>${line.slice(2)}</li>`;
        if (line.trim() === "") return "";
        return `<p>${line}</p>`;
      })
      .join("");

    return {
      title,
      content: formatted || `<p>${textContent}</p>`,
      format: "MD",
      size: file.size,
    };
  }

  // Plain Text / Script formats: Convert newlines to paragraphs/breaks
  const paragraphs = textContent
    .split(/\r?\n\r?\n/)
    .map((block) => `<p>${block.replace(/\r?\n/g, "<br/>")}</p>`)
    .join("");

  return {
    title,
    content: paragraphs || textContent,
    format: ext.toUpperCase() || "TXT",
    size: file.size,
  };
}
