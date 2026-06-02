const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron')
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
    frame: false,           // Remove default OS titlebar
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '..', 'electron', 'assets', 'apple-icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#0f0f1a',
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Inject custom titlebar after page loads
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      (function() {
        // Don't inject twice
        if (document.getElementById('volt-titlebar')) return;

        const bar = document.createElement('div');
        bar.id = 'volt-titlebar';
        bar.style.cssText = \`
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 38px;
          background: linear-gradient(90deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%);
          border-bottom: 1px solid rgba(139, 92, 246, 0.15);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px 0 16px;
          z-index: 999999;
          -webkit-app-region: drag;
          user-select: none;
          backdrop-filter: blur(12px);
        \`;

        // Left: Volt logo + name
        const left = document.createElement('div');
        left.style.cssText = 'display:flex;align-items:center;gap:8px;';
        left.innerHTML = \`
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex-shrink:0">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="url(#vg)" stroke="none"/>
            <defs>
              <linearGradient id="vg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#22c55e"/>
                <stop offset="100%" stop-color="#8b5cf6"/>
              </linearGradient>
            </defs>
          </svg>
          <span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.85);letter-spacing:0.05em;">VOLT</span>
        \`;

        // Right: window controls
        const controls = document.createElement('div');
        controls.style.cssText = 'display:flex;align-items:center;gap:4px;-webkit-app-region:no-drag;';

        function makeBtn(id, title, svgPath, hoverColor) {
          const btn = document.createElement('button');
          btn.id = id;
          btn.title = title;
          btn.style.cssText = \`
            width:32px;height:28px;border:none;background:transparent;border-radius:6px;
            display:flex;align-items:center;justify-content:center;cursor:pointer;
            transition:background 0.15s;color:rgba(255,255,255,0.5);
          \`;
          btn.innerHTML = \`<svg width="11" height="11" viewBox="0 0 11 11" fill="none">\${svgPath}</svg>\`;
          btn.onmouseenter = () => {
            btn.style.background = hoverColor;
            btn.style.color = 'rgba(255,255,255,0.9)';
          };
          btn.onmouseleave = () => {
            btn.style.background = 'transparent';
            btn.style.color = 'rgba(255,255,255,0.5)';
          };
          return btn;
        }

        const minBtn = makeBtn('volt-min', 'Minimize',
          '<line x1="1" y1="5.5" x2="10" y2="5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
          'rgba(255,255,255,0.08)'
        );

        const maxBtn = makeBtn('volt-max', 'Maximize',
          '<rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/>',
          'rgba(255,255,255,0.08)'
        );

        const closeBtn = makeBtn('volt-close', 'Close',
          '<line x1="1.5" y1="1.5" x2="9.5" y2="9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="9.5" y1="1.5" x2="1.5" y2="9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
          'rgba(239,68,68,0.7)'
        );

        minBtn.onclick = () => window.voltApp?.minimize();
        maxBtn.onclick = () => window.voltApp?.maximize();
        closeBtn.onclick = () => window.voltApp?.close();

        controls.appendChild(minBtn);
        controls.appendChild(maxBtn);
        controls.appendChild(closeBtn);

        bar.appendChild(left);
        bar.appendChild(controls);
        document.body.appendChild(bar);

        // Push page content down so titlebar doesn't overlap
        const style = document.createElement('style');
        style.id = 'volt-titlebar-style';
        style.textContent = 'body { padding-top: 38px !important; } #volt-titlebar + * { margin-top: 0 !important; }';
        document.head.appendChild(style);
      })();
    `)
  })

  mainWindow.loadURL(`${VOLT_URL}/login`)

  // Open external links in system browser
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

  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow.loadURL(`data:text/html,
      <html>
        <body style="margin:0;background:#0f0f1a;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:white;">
          <div style="font-size:48px;margin-bottom:16px;">⚡</div>
          <div style="font-size:20px;font-weight:bold;margin-bottom:8px;">Unable to connect</div>
          <div style="font-size:13px;opacity:0.6;margin-bottom:24px;">Please check your internet connection</div>
          <button onclick="window.location.href='${VOLT_URL}/login'" style="padding:10px 24px;background:linear-gradient(135deg,#22c55e,#8b5cf6);color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">Try Again</button>
        </body>
      </html>
    `)
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// IPC handlers for window controls (called from preload)
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window-close', () => mainWindow?.close())

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
