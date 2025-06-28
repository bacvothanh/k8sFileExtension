// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('powershell', {
  run: (command) => ipcRenderer.invoke('run-powershell', command),
  ensureDebug: (namespace, configMapName) => ipcRenderer.invoke('ensure-debug', namespace, configMapName),
  saveTempFile: (filename, content) => ipcRenderer.invoke('save-temp-file', filename, content),
  deleteTempFile: (filename) => ipcRenderer.invoke('delete-temp-file', filename)
});
