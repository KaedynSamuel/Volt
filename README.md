# Volt — Full Project

This is your complete Volt project with everything set up:
- ✅ Next.js app (your original code)
- ✅ Azure App Service deployment (server.js + web.config)
- ✅ Security headers (next.config.mjs)
- ✅ Electron desktop app (Windows .exe + Mac .dmg)
- ✅ PWA support (manifest.json + sw.js)

---

## ─── PART 1: Deploy to Azure (do this first) ───

### Step 1 — Set environment variables in Azure Portal
App Service → Configuration → Application Settings → add:

| Name             | Value                                    |
|------------------|------------------------------------------|
| NODE_ENV         | production                               |
| SQL_SERVER       | yourserver.database.windows.net          |
| SQL_DATABASE     | your database name                       |
| SQL_USER         | your SQL username                        |
| SQL_PASSWORD     | your SQL password                        |
| SQL_PORT         | 1433                                     |
| WEBSITES_PORT    | 3000                                     |

Optional (for email):
| VOLT_EMAIL_WEBHOOK_URL    | https://api.resend.com/emails   |
| VOLT_EMAIL_WEBHOOK_SECRET | your Resend API key             |
| VOLT_EMAIL_FROM           | Volt <no-reply@yourdomain.com>  |

### Step 2 — Set startup command
App Service → Configuration → General Settings → Startup Command:
```
node server.js
```

### Step 3 — Build locally
```bash
npm install
npm run build
```

### Step 4 — Zip these folders/files and upload via Kudu
```
✅ .next/
✅ public/
✅ app/
✅ lib/
✅ components/
✅ node_modules/
✅ electron/
✅ server.js
✅ web.config
✅ package.json
✅ next.config.mjs
✅ tsconfig.json

❌ .git/
❌ .env.local
❌ assets/       (not needed on Azure)
❌ dist/         (not needed on Azure)
```

Upload at: App Service → Advanced Tools → Zip Push Deploy

---

## ─── PART 2: Build the Desktop App (.exe / .dmg) ───

### Step 1 — Add your icons to the assets/ folder
See assets/README.txt for instructions.
Quick version:
- Copy public/apple-icon.png → assets/icon.png
- Convert to .ico and .icns at cloudconvert.com

### Step 2 — Set your Azure URL in electron/main.js
Open electron/main.js and update the SQL credentials (lines ~20-27)
with the same values you used in Azure.

Or better: set them as environment variables on your machine so they
aren't hardcoded:
```
SQL_SERVER=yourserver.database.windows.net
SQL_DATABASE=yourdb
SQL_USER=youruser
SQL_PASSWORD=yourpassword
```

### Step 3 — Build
```bash
npm install
npm run build          # Build Next.js first

npm run build:win      # → dist/Volt Setup 1.0.0.exe  (Windows)
npm run build:mac      # → dist/Volt-1.0.0.dmg        (Mac — must be on a Mac)
```

### Step 4 — Send to testers
- Windows testers get: `dist/Volt Setup 1.0.0.exe`
- Mac testers get: `dist/Volt-1.0.0.dmg`

They double-click to install. Volt appears in Start Menu / Applications.

---

## ─── How the desktop app works ───

The Electron app starts an embedded Next.js server on localhost:3000,
then opens a native window pointing to it. Your Azure SQL database is
still the backend — all data goes through your existing API routes.

This means:
- No browser address bar
- Appears in taskbar / Start Menu / dock
- Works like Teams, Slack, VS Code
- Data is still on your Azure SQL — nothing stored locally

---

## ─── Warnings for testers ───

**Windows:** A "Windows protected your PC" popup may appear because the
.exe isn't code-signed. Testers should click "More info" → "Run anyway".
This is normal for unsigned apps. To remove this warning permanently,
you'd need a code signing certificate (~$200/year) — not needed for testing.

**Mac:** May say "can't be opened because Apple cannot check it".
Right-click the app → Open → Open anyway.
Or: System Settings → Privacy & Security → Open Anyway.
