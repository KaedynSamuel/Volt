const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('voltApp', {
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
})
