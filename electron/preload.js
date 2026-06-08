const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('voltApp', {
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',
})
