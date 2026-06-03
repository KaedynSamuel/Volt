const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron')
const path = require('path')

const VOLT_URL = 'https://voltapp-fpfsbdcje3ewh2fa.canadacentral-01.azurewebsites.net'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 820,
    minWidth: 960,
    minHeight: 620,
    title: 'Volt',
    frame: false,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#ffffff',
    show: false,
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      (function() {
        if (document.getElementById('volt-titlebar')) return;
        const bar = document.createElement('div');
        bar.id = 'volt-titlebar';
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:36px;background:linear-gradient(90deg,#0f0f1a 0%,#1a1a2e 50%,#0f0f1a 100%);border-bottom:1px solid rgba(139,92,246,0.18);display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 14px;z-index:999999;-webkit-app-region:drag;user-select:none;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);';
        const left = document.createElement('div');
        left.style.cssText = 'display:flex;align-items:center;gap:7px;';
        left.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="vg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#22c55e"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="url(#vg)"/></svg><span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.82);letter-spacing:0.08em;">VOLT</span>';
        const controls = document.createElement('div');
        controls.style.cssText = 'display:flex;align-items:center;gap:3px;-webkit-app-region:no-drag;';
        function mkBtn(id,title,svgPath,hoverBg){
          const b=document.createElement('button');
          b.id=id;b.title=title;
          b.style.cssText='width:30px;height:26px;border:none;background:transparent;border-radius:5px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.15s;';
          b.innerHTML='<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.4" stroke-linecap="round">'+svgPath+'</svg>';
          b.onmouseenter=()=>{b.style.background=hoverBg;b.querySelector('svg').setAttribute('stroke','rgba(255,255,255,0.9)');};
          b.onmouseleave=()=>{b.style.background='transparent';b.querySelector('svg').setAttribute('stroke','rgba(255,255,255,0.5)');};
          return b;
        }
        const min=mkBtn('volt-min','Minimize','<line x1="1" y1="5.5" x2="10" y2="5.5"/>','rgba(255,255,255,0.08)');
        const max=mkBtn('volt-max','Maximize','<rect x="1" y="1" width="9" height="9" rx="1.5"/>','rgba(255,255,255,0.08)');
        const cls=mkBtn('volt-close','Close','<line x1="1.5" y1="1.5" x2="9.5" y2="9.5"/><line x1="9.5" y1="1.5" x2="1.5" y2="9.5"/>','rgba(239,68,68,0.75)');
        min.onclick=()=>window.voltApp&&window.voltApp.minimize();
        max.onclick=()=>window.voltApp&&window.voltApp.maximize();
        cls.onclick=()=>window.voltApp&&window.voltApp.close();
        controls.append(min,max,cls);
        bar.append(left,controls);
        document.body.appendChild(bar);
        if(!document.getElementById('volt-titlebar-style')){
          const s=document.createElement('style');
          s.id='volt-titlebar-style';
          s.textContent='body{padding-top:36px!important;}';
          document.head.appendChild(s);
        }
      })();
    `).catch(()=>{})
  })

  mainWindow.loadURL(VOLT_URL + '/login')

  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    if (!url.startsWith(VOLT_URL)) { shell.openExternal(url); return {action:'deny'} }
    return {action:'allow'}
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(VOLT_URL)) { event.preventDefault(); shell.openExternal(url) }
  })

  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow.loadURL('data:text/html,<html><body style="margin:0;background:#0f0f1a;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:white"><div style="font-size:40px;margin-bottom:14px">&#9889;</div><div style="font-size:18px;font-weight:bold;margin-bottom:6px">Unable to connect</div><div style="font-size:12px;opacity:0.5;margin-bottom:20px">Check your internet connection</div><button onclick="window.location.reload()" style="padding:9px 22px;background:linear-gradient(135deg,#22c55e,#8b5cf6);color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">Try Again</button></body></html>')
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize())
ipcMain.on('window-maximize', () => mainWindow && (mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()))
ipcMain.on('window-close', () => mainWindow && mainWindow.close())

Menu.setApplicationMenu(null)

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
