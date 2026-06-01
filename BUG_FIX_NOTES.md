# Volt bug-fix changes

## What changed

- Removed the active access-code flow from the UI and API.
- Added admin-created users in the Team page.
- Added company Teams with team members.
- Added secure team workspaces:
  - encrypted team chat
  - encrypted team file upload/download
  - files stored in SQL Server as encrypted `VARBINARY(MAX)` payloads
- Added admin OTP onboarding API at `/api/auth/admin-otp`.
- Added global flowing gradient button animation using the selected company colours.
- Added Volty walkthroughs to Tasks and Tickets.
- Added SQL migration: `database/admin-teams-otp-secure-chat.sql`.

## What to run

1. Run this SQL file against your database:

```sql
-- database/admin-teams-otp-secure-chat.sql
```

2. Install dependencies:

```bash
npm install
```

3. Start the app:

```bash
npm run dev
```

## Important security note

The team chat and files are encrypted in the browser before saving to SQL. The database stores encrypted payloads and IVs, not plain chat/file content. The current implementation gives authorised team members the team key through the app API after permission checks. For strict production-grade end-to-end encryption where the server can never access team keys, the next step is adding per-user public/private key wrapping.

## OTP note

`/api/auth/admin-otp` creates and verifies OTPs. In development it returns `devOtp` so you can test. In production it does not expose the OTP; connect your email/SMS provider where the route currently says to do that.
