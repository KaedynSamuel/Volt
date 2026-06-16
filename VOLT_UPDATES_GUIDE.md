# Volt Updates Guide — June 2026

This document covers everything that changed in this update, plus the setup
steps needed in Azure to make Microsoft/Google sign-in, real email sending,
and a reliable worldwide login experience all work.

---

## 1. Email-based login (Microsoft, Google, work email)

The login page now has **"Continue with Microsoft"** and **"Continue with
Google"** buttons, in addition to the existing email/password form.

**How it works:**
1. The person clicks "Continue with Microsoft" (covers Microsoft 365 work/school
   accounts *and* personal Outlook/Hotmail accounts) or "Continue with Google"
   (covers Gmail and Google Workspace "work email" accounts).
2. Microsoft/Google verifies who they are and hands back their real, verified
   email address.
3. Volt looks that email up in your existing `AppUsers` table (the same table
   your company admin manages on the Team page).
4. If it finds a match, the person is logged straight into their dashboard —
   no password needed.
5. If there's no match, they see "Ask your admin to add you" — **your admin
   still controls who gets in**, just now by adding the person's real
   Microsoft/Google/work email address instead of (or alongside) a password.

### Setup steps

#### A. Generate an Auth secret
Run this once locally and copy the output:
```bash
npx auth secret
```
Set the result as `AUTH_SECRET` in Azure (see step D).

#### B. Microsoft sign-in (Azure AD App Registration)
1. Go to **Azure Portal → Microsoft Entra ID → App registrations → New registration**.
2. Name it "Volt", and under **Supported account types** choose
   *"Accounts in any organizational directory and personal Microsoft accounts"*
   (this is what lets work emails AND personal Microsoft emails both sign in).
3. Under **Redirect URI**, choose "Web" and enter:
   `https://YOUR-APP.azurewebsites.net/api/auth/callback/microsoft-entra-id`
4. After creating it, copy the **Application (client) ID** →
   `AUTH_MICROSOFT_ENTRA_ID_ID`.
5. Go to **Certificates & secrets → New client secret**, copy the **value**
   (not the ID) → `AUTH_MICROSOFT_ENTRA_ID_SECRET`.
6. Leave `AUTH_MICROSOFT_ENTRA_ID_ISSUER` as `https://login.microsoftonline.com/common/v2.0`
   (already the default) unless you want to restrict sign-in to only your
   organization's tenant — in that case use
   `https://login.microsoftonline.com/<your-tenant-id>/v2.0`.

#### C. Google sign-in (Google Cloud OAuth Client)
1. Go to **Google Cloud Console → APIs & Services → Credentials → Create
   Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Under **Authorized redirect URIs**, add:
   `https://YOUR-APP.azurewebsites.net/api/auth/callback/google`
4. Copy the **Client ID** → `AUTH_GOOGLE_ID` and **Client secret** →
   `AUTH_GOOGLE_SECRET`.
5. If your company uses Google Workspace, you can restrict the consent screen
   to "Internal" so only your organization's Google accounts can sign in.

#### D. Add the environment variables in Azure
Go to **Azure Portal → your App Service → Configuration → Application
settings** and add (see `.env.example` for the full list):

| Name | Value |
|---|---|
| `AUTH_SECRET` | the value generated in step A |
| `AUTH_URL` | `https://YOUR-APP.azurewebsites.net` |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | from step B |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | from step B |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | `https://login.microsoftonline.com/common/v2.0` |
| `AUTH_GOOGLE_ID` | from step C |
| `AUTH_GOOGLE_SECRET` | from step C |

Click **Save**, then **Restart** the App Service.

---

## 2. Making login (and the whole app) reliable worldwide on Azure

Volt already deploys to **Azure App Service** via the GitHub Actions workflow
in `.github/workflows/build.yml`. Here's how to make sure logins and the rest
of the app stay fast and reliable for users anywhere in the world:

### A. Always On
Azure App Service puts idle apps to sleep. The first login after a period of
inactivity can then take 10-30 seconds (the database connection + Next.js
server have to "wake up"). Turn on:
**App Service → Configuration → General settings → Always On → On**
(requires a Basic tier or higher plan — not available on Free/Shared tiers).

### B. Azure SQL firewall + connection pooling
Volt's login routes connect to Azure SQL on every request. Make sure:
1. **Azure SQL Server → Networking → "Allow Azure services and resources to
   access this server"** is **ON**, so the App Service can reach the database.
2. If you see intermittent login failures under load, check the Azure SQL
   **DTU/vCore usage** — the `S0`/Basic tiers have very limited concurrent
   connections. Scale up if many people log in at the same time.

### C. Region & latency
- Deploy the App Service and the Azure SQL database **in the same Azure
  region** (e.g. both in "West Europe") — this avoids slow cross-region
  database calls on every login.
- For a worldwide user base, consider **Azure Front Door** or a **CDN** in
  front of the App Service. This caches static assets (images, fonts, the
  Volty animations) close to users everywhere, so only login/API calls hit
  your App Service directly.

### D. Custom domain + HTTPS
Microsoft/Google OAuth **requires HTTPS redirect URIs**. Azure App Service
gives you a free `*.azurewebsites.net` HTTPS domain automatically — if you
add a custom domain (e.g. `app.yourcompany.com`), remember to:
1. Add a TLS/SSL binding for the custom domain in **App Service → Custom
   domains → Add binding**.
2. Update `AUTH_URL` and the OAuth redirect URIs (steps 1B/1C above) to use
   the new domain.

### E. Scaling for concurrent logins worldwide
- **App Service Plan → Scale up** (more CPU/RAM per instance) helps with
  heavier per-request work (PDF/print rendering, AI calls).
- **App Service Plan → Scale out** (more instances) helps with many
  *simultaneous* users/logins. Because Volt's session is stored in the
  browser (not server memory), it's safe to run multiple instances behind
  the load balancer — any instance can handle any login.

### F. Health checks
Enable **App Service → Health check** pointing at `/` (or `/login`). This
lets Azure automatically take an unhealthy instance out of rotation so users
worldwide don't hit a broken server.

---

## 3. Other fixes in this update

- **Hydration error on every page** — fixed by adding
  `suppressHydrationWarning` to the `<html>` tag in `app/layout.tsx`. The
  light/dark theme script runs before paint and was causing a one-time,
  harmless mismatch warning that Next.js was treating as an error.

- **Ticket reminders** — tickets now have a **"Remind [name]"** button. It
  only shows on tickets *you created* that are still open/in-progress and
  have someone assigned. Pressing it sends the assignee an in-app
  notification ("Reminder: ...") and an email (once SMTP is configured —
  see `.env.example`).

- **Project team picker** — when creating a project, the member picker now
  shows just people's names (no role labels).

- **Brand colours** — when a company picks custom primary/accent colours
  during setup, Volt now automatically chooses readable black or white text
  for buttons and badges based on the colour's brightness, so "Create"
  buttons and status badges never disappear against light colours. The setup
  wizard's colour step now shows a live preview of a button and badges.

- **Team chat unread badge** — the Chat tab on the Team page now shows the
  number of **unread** messages (tracked per-team, per-user via local
  storage and cleared when you open the chat), instead of the total number
  of messages ever sent.

- **Volty AI assistant** — greetings ("hi", "hello", "how's it going") and
  thank-yous now get a friendly, on-brand reply instead of "I'm not sure how
  to help with that." For the AI to understand free-form requests (not just
  greetings), set `GROQ_API_KEY` (free at console.groq.com) in Azure — see
  `.env.example`.

- **Volt Docs** — added a **"Download PDF"** button (opens a clean
  print-ready version of your document and triggers the browser's print →
  "Save as PDF"). The editor now sits in a paper-style card with placeholder
  text, and the old "Export" button is now clearly labelled "Export HTML".

- **Volt Sheets** — CSV export is now more reliable across browsers (the
  download link is properly attached/cleaned up), and rows are zebra-striped
  for readability.

- **Real email sending** — `sendVoltEmailNotification` (used by ticket
  reminders, ticket assignment emails, and EmailV) now supports SMTP via
  `nodemailer`. Configure `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` /
  `SMTP_PASSWORD` / `VOLT_EMAIL_FROM` in Azure (works with Microsoft 365,
  Google Workspace, or any SMTP relay) and emails will actually be delivered
  instead of just logged.

- **Achievements page**
  - Fixed the bug where the **level-up animation played every time you
    opened the page** (even with no new XP). It now only plays on a genuine
    level-up.
  - Removed the continuous pulsing/glowing **animation on the Tier Roadmap**
    cards (per your request) — the roadmap is now static.
  - Added a new **"Volt Architect"** legendary badge (10,000 XP) with a
    custom glowing crown design.
  - The **"View Banner"** profile card now only lets you pick a banner theme
    you've actually unlocked (locked themes show a lock icon and tooltip),
    and you can **save** your chosen banner theme so it's remembered next
    time — with a "Banner Saved" confirmation.

None of your existing animations (Volty mascot, level-up screens, badge pop
effects, etc.) were changed except the Tier Roadmap glow, as requested.
