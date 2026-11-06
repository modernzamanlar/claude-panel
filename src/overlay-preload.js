// Ekran kontrolü çerçevesi için en küçük köprü: yalnız ana süreçten gelen görsel durumu dinler, hiçbir IPC çağrısı yapamaz.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ov', {
  on: cb => { ipcRenderer.on('ov', (_e, m) => cb(m)); },
});
