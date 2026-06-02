import { contextBridge, ipcRenderer } from 'electron';

// Expose a safe, context-isolated API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  saveFileDialog: (defaultName: string): Promise<string | undefined> =>
    ipcRenderer.invoke('dialog:saveFile', defaultName),

  exportPrintToPDF: (savePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('export:printToPDF', savePath),

  exportCustomPDF: (payload: any): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('export:customPDF', payload),
});
