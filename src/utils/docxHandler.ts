import mammoth from "mammoth";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from "docx";

/**
 * Options for Mammoth to preserve document formatting, headings, tables,
 * and embedded images in base64.
 */
const MAMMOTH_OPTIONS = {
  convertImage: mammoth.images.imgElement((image: {
    read: (type: string) => Promise<string>;
    contentType: string;
  }) => {
    return image.read("base64").then((imageBuffer: string) => {
      return {
        src: `data:${image.contentType};base64,${imageBuffer}`,
        class: "docx-embedded-img",
      };
    });
  }),
  styleMap: [
    "p[style-name='Title'] => h1.docx-doc-title:fresh",
    "p[style-name='Subtitle'] => h2.docx-doc-subtitle:fresh",
    "p[style-name='Heading 1'] => h1:fresh",
    "p[style-name='Heading 2'] => h2:fresh",
    "p[style-name='Heading 3'] => h3:fresh",
    "p[style-name='Heading 4'] => h4:fresh",
    "p[style-name='Quote'] => blockquote:fresh",
    "p[style-name='Intense Quote'] => blockquote:fresh",
    "table => table.docx-table:fresh",
    "r[style-name='Strong'] => strong",
    "r[style-name='Emphasis'] => em",
  ],
  includeDefaultStyleMap: true,
};

/**
 * Normalizes HTML generated from DOCX to ensure nice rendering in our rich editor.
 */
export function sanitizeDocxHtml(rawHtml: string): string {
  if (!rawHtml || typeof document === "undefined") return rawHtml || "<p></p>";

  const container = document.createElement("div");
  container.innerHTML = rawHtml;

  // Enhance tables
  const tables = container.querySelectorAll("table");
  tables.forEach((table) => {
    table.classList.add("docx-table");
    const cells = table.querySelectorAll("td, th");
    cells.forEach((cell) => {
      if (!cell.textContent?.trim() && !cell.children.length) {
        cell.innerHTML = "&nbsp;";
      }
    });
  });

  // Enhance images
  const images = container.querySelectorAll("img");
  images.forEach((img) => {
    img.classList.add("docx-embedded-img");
  });

  return container.innerHTML;
}

/**
 * Parses a Word .docx ArrayBuffer into clean, structured HTML.
 */
export async function parseDocxToHtml(arrayBuffer: ArrayBuffer): Promise<{
  html: string;
  rawText: string;
}> {
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer }, MAMMOTH_OPTIONS);
    let html = result.value;

    if (!html || html.trim() === "") {
      const rawTextResult = await mammoth.extractRawText({ arrayBuffer });
      const lines = rawTextResult.value
        .split("\n")
        .filter((l) => l.trim().length > 0);

      html = lines.map((l) => `<p>${l}</p>`).join("");
      return { html: html || "<p></p>", rawText: rawTextResult.value };
    }

    const cleanHtml = sanitizeDocxHtml(html);
    const rawResult = await mammoth.extractRawText({ arrayBuffer });
    return { html: cleanHtml, rawText: rawResult.value };
  } catch (error) {
    console.error("Mammoth error while parsing docx:", error);
    throw error;
  }
}

/**
 * Converts DOM nodes into docx TextRun instances preserving bold, italic, underline.
 */
function parseInlineNodesToTextRuns(node: Node): TextRun[] {
  const runs: TextRun[] = [];

  function traverse(currentNode: Node, isBold: boolean, isItalic: boolean, isUnderline: boolean) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const text = currentNode.textContent || "";
      if (text) {
        runs.push(
          new TextRun({
            text,
            bold: isBold,
            italics: isItalic,
            underline: isUnderline ? {} : undefined,
            size: 22, // 11pt
          })
        );
      }
      return;
    }

    if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const elem = currentNode as HTMLElement;
      const tag = elem.tagName.toLowerCase();

      const nextBold = isBold || tag === "strong" || tag === "b";
      const nextItalic = isItalic || tag === "em" || tag === "i";
      const nextUnderline = isUnderline || tag === "u";

      if (tag === "br") {
        runs.push(new TextRun({ break: 1 }));
        return;
      }

      elem.childNodes.forEach((child) => {
        traverse(child, nextBold, nextItalic, nextUnderline);
      });
    }
  }

  traverse(node, false, false, false);
  return runs.length > 0 ? runs : [new TextRun({ text: " ", size: 22 })];
}

/**
 * Converts Editor HTML into docx Paragraph and Table elements.
 */
export function convertHtmlToDocxElements(html: string): (Paragraph | Table)[] {
  if (typeof document === "undefined") {
    return [
      new Paragraph({
        children: [new TextRun({ text: html, size: 22 })],
      }),
    ];
  }

  const container = document.createElement("div");
  container.innerHTML = html || "<p></p>";

  const docElements: (Paragraph | Table)[] = [];

  const children = Array.from(container.childNodes);

  for (const node of children) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        docElements.push(
          new Paragraph({
            children: [new TextRun({ text, size: 22 })],
            spacing: { after: 120 },
          })
        );
      }
      continue;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement;
      const tag = elem.tagName.toLowerCase();

      // Heading 1
      if (tag === "h1") {
        docElements.push(
          new Paragraph({
            children: parseInlineNodesToTextRuns(elem),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
          })
        );
        continue;
      }

      // Heading 2
      if (tag === "h2") {
        docElements.push(
          new Paragraph({
            children: parseInlineNodesToTextRuns(elem),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
        continue;
      }

      // Heading 3
      if (tag === "h3") {
        docElements.push(
          new Paragraph({
            children: parseInlineNodesToTextRuns(elem),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 80 },
          })
        );
        continue;
      }

      // Blockquote
      if (tag === "blockquote") {
        docElements.push(
          new Paragraph({
            children: parseInlineNodesToTextRuns(elem),
            indent: { left: 720 },
            spacing: { before: 120, after: 120 },
          })
        );
        continue;
      }

      // Unordered list
      if (tag === "ul") {
        const listItems = elem.querySelectorAll(":scope > li");
        listItems.forEach((li) => {
          docElements.push(
            new Paragraph({
              children: parseInlineNodesToTextRuns(li),
              bullet: { level: 0 },
              spacing: { after: 60 },
            })
          );
        });
        continue;
      }

      // Ordered list
      if (tag === "ol") {
        const listItems = elem.querySelectorAll(":scope > li");
        listItems.forEach((li) => {
          docElements.push(
            new Paragraph({
              children: parseInlineNodesToTextRuns(li),
              numbering: { reference: "default-numbering", level: 0 },
              spacing: { after: 60 },
            })
          );
        });
        continue;
      }

      // Table
      if (tag === "table") {
        const rows = Array.from(elem.querySelectorAll("tr"));
        if (rows.length > 0) {
          const docxRows: TableRow[] = [];

          rows.forEach((row) => {
            const cells = Array.from(row.querySelectorAll("td, th"));
            const docxCells: TableCell[] = cells.map((cell) => {
              return new TableCell({
                children: [
                  new Paragraph({
                    children: parseInlineNodesToTextRuns(cell),
                    spacing: { after: 60, before: 60 },
                  }),
                ],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                  left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                },
              });
            });

            if (docxCells.length > 0) {
              docxRows.push(new TableRow({ children: docxCells }));
            }
          });

          if (docxRows.length > 0) {
            docElements.push(
              new Table({
                rows: docxRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
              })
            );
          }
        }
        continue;
      }

      // Default Paragraph
      docElements.push(
        new Paragraph({
          children: parseInlineNodesToTextRuns(elem),
          spacing: { after: 120 },
        })
      );
    }
  }

  return docElements.length > 0
    ? docElements
    : [
        new Paragraph({
          children: [new TextRun({ text: " ", size: 22 })],
        }),
      ];
}

/**
 * Creates a real native Word (.docx) file from document title and editor HTML.
 */
export async function exportHtmlToDocxBlob(title: string, html: string): Promise<Blob> {
  const docElements: (Paragraph | Table)[] = [];

  // Document Title Header
  docElements.push(
    new Paragraph({
      text: title || "Sem Título",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      spacing: { after: 150 },
    })
  );

  // Subtitle / Date
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  docElements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Gerado em ${dateStr} • Editor Bloco de Notas Moderno`,
          italics: true,
          color: "666666",
          size: 18,
        }),
      ],
      spacing: { after: 300 },
    })
  );

  // Add content elements converted from HTML
  const contentElements = convertHtmlToDocxElements(html);
  docElements.push(...contentElements);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docElements,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
