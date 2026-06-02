import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export type ExportOptions = {
  elements: HTMLElement[];
  scale?: number; // 4 for high-DPI (300+ DPI equivalent)
  bleedMm?: number; // Bleed in mm
  drawCropMarks?: boolean;
  onProgress?: (current: number, total: number) => void;
  filename?: string;
};

export async function exportHighDpiPdf({
  elements,
  scale = 4,
  bleedMm = 3,
  drawCropMarks = true,
  onProgress,
  filename = "Quran_Export.pdf",
}: ExportOptions): Promise<void> {
  if (elements.length === 0) return;

  // Assuming all pages have the same dimensions based on the first one
  const firstEl = elements[0];
  const widthPx = firstEl.offsetWidth;
  const heightPx = firstEl.offsetHeight;

  // Convert PX to MM (approximate, assuming 96 DPI screen)
  const pxToMm = 25.4 / 96;
  const widthMm = widthPx * pxToMm;
  const heightMm = heightPx * pxToMm;

  // Final PDF page size = page size + bleed on all sides
  const pdfWidth = widthMm + bleedMm * 2;
  const pdfHeight = heightMm + bleedMm * 2;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pdfWidth, pdfHeight],
    compress: true,
  });

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    onProgress?.(i + 1, elements.length);

    // Capture the DOM element as a high-res image
    const canvas = await html2canvas(el, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    if (i > 0) {
      pdf.addPage([pdfWidth, pdfHeight], "portrait");
    }

    // Add image centered in the PDF page (with bleed margins)
    pdf.addImage(imgData, "JPEG", bleedMm, bleedMm, widthMm, heightMm);

    // Draw crop marks if requested
    if (drawCropMarks) {
      pdf.setDrawColor(0, 0, 0); // Registration black
      pdf.setLineWidth(0.2);

      const markLen = 5; // 5mm crop marks
      const offset = 2; // 2mm offset from the actual page edge

      // Top Left
      pdf.line(bleedMm - offset, bleedMm, bleedMm - offset - markLen, bleedMm); // Horizontal
      pdf.line(bleedMm, bleedMm - offset, bleedMm, bleedMm - offset - markLen); // Vertical

      // Top Right
      pdf.line(pdfWidth - bleedMm + offset, bleedMm, pdfWidth - bleedMm + offset + markLen, bleedMm);
      pdf.line(pdfWidth - bleedMm, bleedMm - offset, pdfWidth - bleedMm, bleedMm - offset - markLen);

      // Bottom Left
      pdf.line(bleedMm - offset, pdfHeight - bleedMm, bleedMm - offset - markLen, pdfHeight - bleedMm);
      pdf.line(bleedMm, pdfHeight - bleedMm + offset, bleedMm, pdfHeight - bleedMm + offset + markLen);

      // Bottom Right
      pdf.line(pdfWidth - bleedMm + offset, pdfHeight - bleedMm, pdfWidth - bleedMm + offset + markLen, pdfHeight - bleedMm);
      pdf.line(pdfWidth - bleedMm, pdfHeight - bleedMm + offset, pdfWidth - bleedMm, pdfHeight - bleedMm + offset + markLen);
    }
  }

  pdf.save(filename);
}
