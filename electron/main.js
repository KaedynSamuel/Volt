const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('path')

// Your live Azure URL
const VOLT_URL = 'https://voltapp-fpfsbdcje3ewh2fa.canadacentral-01.azurewebsites.net'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Volt',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    backgroundColor: '#1a1a2e',
    show: false,
  })

  // Show a loading screen while Azure loads
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.loadURL(`${VOLT_URL}/login`)

  // Open external links in system browser, not inside the app
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

  // Show error page if Azure is unreachable
  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow.loadURL(`data:text/html,
      <html>
        <body style="margin:0;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:white;">
          <div style="font-size:48px;margin-bottom:16px;">⚡</div>
          <div style="font-size:20px;font-weight:bold;margin-bottom:8px;">Unable to connect</div>
          <div style="font-size:13px;opacity:0.6;margin-bottom:24px;">Please check your internet connection</div>
          <button onclick="window.location.href='${VOLT_URL}/login'" style="padding:10px 24px;background:#6366f1;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Try Again</button>
        </body>
      </html>
    `)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
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

app.on('web-contents-created', (_, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
})
