import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

const PAGE_WIDTH_PT  = 780 * (72 / 96);  // convert px@96dpi → PDF points@72dpi
const PAGE_HEIGHT_PT = 1170 * (72 / 96);

export async function renderToPDF(
  pages: any[],
  fontPaths: { arabic: string; bangla: string },
  outputPath: string,
): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load fonts from the actual files
  const arabicFontBytes = fs.readFileSync(fontPaths.arabic);
  const banglaFontBytes = fs.readFileSync(fontPaths.bangla);
  const arabicFont = await pdfDoc.embedFont(arabicFontBytes);
  const banglaFont = await pdfDoc.embedFont(banglaFontBytes);

  for (const pageData of pages) {
    const pdfPage = pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);

    // Renders the header
    pdfPage.drawText(pageData.title || '', {
      x: PAGE_WIDTH_PT / 2 - 50,
      y: PAGE_HEIGHT_PT - 40,
      size: 14,
      font: banglaFont,
      color: rgb(0, 0, 0),
    });

    // Renders the footer
    if (pageData.footer) {
      pdfPage.drawText(String(pageData.footer.pageNo || ''), {
        x: PAGE_WIDTH_PT / 2 - 10,
        y: 20,
        size: 10,
        font: banglaFont,
        color: rgb(0.3, 0.3, 0.3),
      });
    }

    // Render slots / lines
    if (pageData.lines) {
      const lineGap = (PAGE_HEIGHT_PT - 100) / 9;
      pageData.lines.forEach((line: any, index: number) => {
        const y = PAGE_HEIGHT_PT - 80 - index * lineGap;

        if (line.arabicLine) {
          pdfPage.drawText(line.arabicLine, {
            x: PAGE_WIDTH_PT - 50,
            y: y,
            size: 18,
            font: arabicFont,
            color: rgb(0, 0, 0),
            // PDF-lib supports text alignment inside drawText for standard fonts
            // but for embedded TTFs, we draw right-to-left
          });
        }

        if (line.banglaLine) {
          pdfPage.drawText(line.banglaLine, {
            x: 50,
            y: y - 20,
            size: 11,
            font: banglaFont,
            color: rgb(0.1, 0.1, 0.1),
          });
        }
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}
