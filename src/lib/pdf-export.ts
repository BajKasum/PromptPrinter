import { jsPDF } from "jspdf";

// Pro-only export (lib/pricing.ts → "PDF- & Markdown-Export"). Renders
// the artifact's markdown as real, selectable text, not a rasterized
// screenshot (jsPDF's `.html()`/html2canvas path), so the output stays
// small, crisp at any zoom, and searchable/copyable. Markdown support is
// deliberately shallow (headings + bullet lists + stripped emphasis
// markers): these are reference documents meant to be read, not a full
// markdown renderer, a heading hierarchy and readable body text cover that.

const MARGIN = 18; // mm
const LINE_HEIGHT = 5.2; // mm
const FONT = { body: 10, h1: 16, h2: 13, h3: 11 } as const;

export function markdownToPdf(title: string, markdown: string): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function heading(text: string, size: number, gapAfter: number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, contentWidth) as string[];
    ensureSpace(LINE_HEIGHT * lines.length);
    for (const line of lines) {
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT * (size / FONT.body) * 0.6 + LINE_HEIGHT * 0.5;
    }
    y += gapAfter;
  }

  function paragraph(text: string, indent = 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT.body);
    const lines = doc.splitTextToSize(text, contentWidth - indent) as string[];
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      doc.text(line, MARGIN + indent, y);
      y += LINE_HEIGHT;
    }
  }

  heading(title, FONT.h1, 4);

  for (const raw of markdown.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "") {
      y += LINE_HEIGHT * 0.5;
      continue;
    }

    const h3 = /^### +(.*)/.exec(line);
    const h2 = /^## +(.*)/.exec(line);
    const h1 = /^# +(.*)/.exec(line);
    if (h1) {
      ensureSpace(LINE_HEIGHT * 2.5);
      heading(h1[1], FONT.h1, 2);
      continue;
    }
    if (h2) {
      ensureSpace(LINE_HEIGHT * 2);
      heading(h2[1], FONT.h2, 1.5);
      continue;
    }
    if (h3) {
      ensureSpace(LINE_HEIGHT * 1.5);
      heading(h3[1], FONT.h3, 1);
      continue;
    }

    // Strip markdown emphasis/code markers rather than rendering them, real
    // inline bold/mono runs would need per-span styling jsPDF's plain text()
    // doesn't give for free, and isn't worth it for a reference export.
    const clean = line
      .replace(/^[-*]\s+/, "•  ")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/`([^`]*)`/g, "$1");
    const isListItem = /^[-*]\s+/.test(line);
    paragraph(clean, isListItem ? 4 : 0);
  }

  // Footer on every page, added last so the page count is final.
  const pageCount = doc.getNumberOfPages();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text("PromptPrinter", MARGIN, pageHeight - 10);
    doc.text(`${i} / ${pageCount}`, pageWidth - MARGIN, pageHeight - 10, { align: "right" });
  }

  return doc;
}

export function downloadMarkdownAsPdf(filename: string, title: string, markdown: string): void {
  markdownToPdf(title, markdown).save(filename);
}
