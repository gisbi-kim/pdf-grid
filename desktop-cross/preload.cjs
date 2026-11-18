'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('pdfGridDesktop', {
  platform: process.platform,
  onPDFOpenRequested(callback) {
    ipcRenderer.on('pdf-grid:open-requested', () => callback());
  },
  getStartupPDF: () => ipcRenderer.invoke('pdf-grid:next'),
  pickPDFs: () => ipcRenderer.invoke('pdf-grid:pick'),
  refreshPDF: id => ipcRenderer.invoke('pdf-grid:refresh', id),
  sourceForFile(file) {
    const filename = webUtils.getPathForFile(file);
    return filename ? ipcRenderer.invoke('pdf-grid:register', filename) : null;
  },
  copyPDFPath: id => ipcRenderer.invoke('pdf-grid:copy-path', id),
  copyPDFImage: bytes => ipcRenderer.invoke('pdf-grid:copy-image', bytes),
  openExternal: url => ipcRenderer.invoke('pdf-grid:external', url),
  saveResult: (name, bytes) => ipcRenderer.invoke('pdf-grid:save', name, bytes),
});
