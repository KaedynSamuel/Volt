# Volt Desktop — Build Guide

This document explains exactly how to build Volt into a Windows `.exe` and macOS `.dmg` installer.

---

## Prerequisites (install once)

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 20 LTS | https://nodejs.org |
| npm | 10+ | comes with Node |
| Git | any | https://git-scm.com |

For **macOS builds on macOS**: Xcode Command Line Tools (`xcode-select --install`)
For **Windows builds on Windows**: Visual Studio Build Tools (optional but recommended)

> You can build the Windows `.exe` from macOS and vice versa — electron-builder handles cross-compilation automatically.

---

## Step 1 — Add your icons

Before building, place these files in `electron/assets/`:

- `icon.ico` — Windows icon (256×256 ICO)
- `icon.icns` — macOS icon (512×512 ICNS)
- `icon.png` — Linux icon (512×512 PNG)

See `electron/assets/README-ICONS.md` for how to generate them quickly.

---

## Step 2 — Configure your environment

Copy `.env.example` to `.env.local` and fill in your database details:

```
SQL_SERVER=your-server.database.windows.net
SQL_DATABASE=VoltDB
SQL_USER=voltuser
SQL_PASSWORD=your-password
VOLT_EMAIL_WEBHOOK_URL=https://your-email-endpoint.com/send
```

> This `.env.local` file gets bundled with the app so users don't need to configure anything.
> **Never commit it to Git.**

---

## Step 3 — Install dependencies

```bash
npm install
```

---

## Step 4 — Update next.config.mjs for desktop

Replace `next.config.mjs` with the desktop version:

```bash
cp electron/next.config.desktop.mjs next.config.mjs
```

This adds `output: 'standalone'` which electron-builder needs.

---

## Step 5 — Build

### Windows installer (.exe)
```bash
npm run electron:build:win
```
Output: `dist/Volt Setup 1.0.0.exe`

### macOS installer (.dmg)
```bash
npm run electron:build:mac
```
Output: `dist/Volt-1.0.0.dmg` (Intel + Apple Silicon)

### Both at once
```bash
npm run electron:build:all
```

---

## Step 6 — Test locally first

Before building the full installer, test the desktop app:

```bash
# Terminal 1: start Next.js
npm run dev

# Terminal 2: launch Electron pointing at it
npm run electron:dev
```

---

## Step 7 — Distribute

### Windows
Send users `dist/Volt Setup 1.0.0.exe` — they double-click, it installs, and Volt appears in their Start Menu and Desktop.

### macOS
Send users `dist/Volt-1.0.0.dmg` — they open it, drag Volt to Applications, done.

---

## What users need

- **Internet connection** — Volt connects to your SQL Server database
- **Nothing else** — Node.js, npm, etc. are all bundled inside the installer

---

## Security features built in

| Feature | Detail |
|---------|--------|
| Context Isolation | Renderer and main process are fully separated |
| Sandboxing | Renderer runs in a sandbox — no OS access |
| No nodeIntegration | React app cannot access Node.js directly |
| Navigation guard | App can't be redirected to external URLs |
| Single instance | Only one Volt window can run at a time |
| Window handler | New windows blocked unless explicitly allowed |
| CSP on splash | Content-Security-Policy on splash screen |
| Hardened Runtime | macOS code hardening enabled for notarization |

---

## Code signing (optional but recommended)

### Windows
Sign with a code signing certificate (EV cert from DigiCert, Sectigo, etc.) to avoid Windows SmartScreen warnings. Add to `electron-builder.yml`:

```yaml
win:
  certificateFile: path/to/cert.pfx
  certificatePassword: your-password
```

### macOS
To distribute outside the App Store without Gatekeeper warnings, you need an Apple Developer account ($99/year). Then notarize:

```yaml
mac:
  notarize:
    teamId: YOUR_TEAM_ID
```

> Without signing, users can still install — they just get a one-time security warning on first launch, which they can bypass.

---

## Troubleshooting

**"App can't be opened because it is from an unidentified developer" (macOS)**
Right-click the app → Open → Open anyway. This only happens once without code signing.

**"Windows protected your PC" (Windows SmartScreen)**
Click "More info" → "Run anyway". Disappears after enough users install it, or with a code signing cert.

**App opens but shows blank/error screen**
- Check that `.env.local` has correct database credentials
- Check that your SQL Server is reachable from the machine

**Build fails with "electron not found"**
Run `npm install` again — electron must be installed before building.
