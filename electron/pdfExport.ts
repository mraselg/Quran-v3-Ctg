import { BrowserWindow } from 'electron';
import fs from 'fs';

export async function handleExportPDF(
  win: BrowserWindow,
  savePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Save current route URL to navigate back to
    const currentURL = win.webContents.getURL();

    // Navigate renderer to a clean print view
    await win.webContents.executeJavaScript(
      `window.location.hash = ''; window.history.pushState({}, '', '/print-preview')`
    );

    // Wait for the print preview to fully render
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'none' },
      pageSize: {
        // Mushaf page: 780×1170px at 96dpi ≈ 206.375×309.6875mm
        // Electron uses microns (1mm = 1000 microns)
        width: 206375,
        height: 309688,
      },
      scaleFactor: 100, // standard scale
    });

    fs.writeFileSync(savePath, pdfBuffer);

    // Navigate back to the original URL
    if (currentURL) {
      await win.webContents.loadURL(currentURL).catch(() => {});
    }

    return { success: true };
  } catch (error: any) {
    console.error('[electron] PDF print failed', error);
    return { success: false, error: error.message };
  }
}
