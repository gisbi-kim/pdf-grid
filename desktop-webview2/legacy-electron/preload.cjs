'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pdfGridDesktop', {
  onPDFOpenRequested: callback => ipcRenderer.on('pdf-open-requested', () => callback()),
  copyPDFImage: bytes => ipcRenderer.invoke('copy-pdf-image', bytes),
  getStartupPDF: () => ipcRenderer.invoke('get-startup-pdf'),
  saveResult: (name, bytes) => ipcRenderer.invoke('save-result', name, bytes),
});
