const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

// ── Config ────────────────────────────────────────────────────────────────
const NEXT_PORT = 3000
const NEXT_URL = `http://localhost:${NEXT_PORT}`
let nextProcess = null
let mainWindow = null

// ── Start the embedded Next.js server ────────────────────────────────────
function startNextServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', 'server.js')

    nextProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(NEXT_PORT),
        // ⚠️ SET YOUR AZURE SQL CREDENTIALS HERE
        // These are used when running as desktop app (not Azure hosted)
        SQL_SERVER: process.env.SQL_SERVER || 'YOUR_SERVER.database.windows.net',
        SQL_DATABASE: process.env.SQL_DATABASE || 'YOUR_DATABASE',
        SQL_USER: process.env.SQL_USER || 'YOUR_SQL_USER',
        SQL_PASSWORD: process.env.SQL_PASSWORD || 'YOUR_SQL_PASSWORD',
        SQL_PORT: process.env.SQL_PORT || '1433',
      },
      cwd: path.join(__dirname, '..'),
    })

    nextProcess.stdout.on('data', (data) => {
      const output = data.toString()
      console.log('[Next.js]', output)
      // Wait until Next.js says it's ready
      if (output.includes('ready') || output.includes('Volt ready')) {
        resolve()
      }
    })

    nextProcess.stderr.on('data', (data) => {
      console.error('[Next.js error]', data.toString())
    })

    nextProcess.on('error', reject)

    // Fallback: poll until the server responds
    const poll = setInterval(() => {
      http.get(NEXT_URL, (res) => {
        if (res.statusCode < 500) {
          clearInterval(poll)
          resolve()
        }
      }).on('error', () => {}) // still starting up, ignore
    }, 500)

    // Give up after 30 seconds
    setTimeout(() => {
      clearInterval(poll)
      reject(new Error('Next.js server did not start in time'))
    }, 30000)
  })
}

// ── Create the native window ──────────────────────────────────────────────
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.loadURL(`${NEXT_URL}/login`)

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(NEXT_URL)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(NEXT_URL)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── Loading splash while Next.js boots ───────────────────────────────────
function createLoadingWindow() {
  const loading = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: { nodeIntegration: false },
  })

  loading.loadURL(`data:text/html,
    <html>
      <body style="margin:0;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:white;">
        <img src="${path.join(__dirname, '..', 'assets', 'icon.png')}" width="80" style="margin-bottom:20px;border-radius:16px;" onerror="this.style.display='none'"/>
        <div style="font-size:24px;font-weight:bold;margin-bottom:8px;">Volt</div>
        <div style="font-size:13px;opacity:0.6;">Starting up...</div>
      </body>
    </html>
  `)

  return loading
}

// ── App lifecycle ─────────────────────────────────────────────────────────
Menu.setApplicationMenu(null)

app.whenReady().then(async () => {
  const loading = createLoadingWindow()

  try {
    await startNextServer()
    loading.close()
    createWindow()
  } catch (err) {
    console.error('Failed to start server:', err)
    loading.close()
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (nextProcess) {
    nextProcess.kill()
    nextProcess = null
  }
})

// Security: prevent new webview creation
app.on('web-contents-created', (_, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
})
