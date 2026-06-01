const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('path')

const VOLT_URL = 'https://voltapp-fpfsbdcje3ewh2fa.canadacentral-01.azurewebsites.net'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Volt',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    backgroundColor: '#1a1a2e',
    show: false,
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.loadURL(`${VOLT_URL}/login`)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(VOLT_URL)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(VOLT_URL)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

Menu.setApplicationMenu(null)
app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})