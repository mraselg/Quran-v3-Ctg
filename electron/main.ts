import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleExportPDF } from './pdfExport.js';
import { renderToPDF } from './pdfRenderer.js';

// Resolve __dirname since the bundle is standard ES/CJS
const isDev = process.env.NODE_ENV === 'development';

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist-electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'default',
    title: 'Quran Studio Pro',
  });

  if (isDev) {
    // In dev: load Vite dev server on port 8080
    win.loadURL('http://localhost:8080');
    win.webContents.openDevTools();
  } else {
    // In production: load the built output
    win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  const win = createWindow();

  // IPC handlers
  ipcMain.handle('dialog:saveFile', async (_, defaultName: string) => {
    const { filePath } = await dialog.showSaveDialog(win, {
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    return filePath;
  });

  ipcMain.handle('export:printToPDF', async (_, savePath: string) => {
    return handleExportPDF(win, savePath);
  });

  ipcMain.handle('export:customPDF', async (_, payload: { pages: any[]; outputPath: string }) => {
    try {
      const fontDir = isDev
        ? path.join(app.getAppPath(), 'public', 'fonts')
        : path.join(process.resourcesPath, 'fonts');

      await renderToPDF(payload.pages, {
        arabic: path.join(fontDir, 'ExcellentArabicWeb2.0.ttf'),
        bangla: path.join(fontDir, 'kalpurush.ttf'),
      }, payload.outputPath);

      return { success: true };
    } catch (e: any) {
      console.error('[electron] custom PDF export failed', e);
      return { success: false, error: e.message };
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
