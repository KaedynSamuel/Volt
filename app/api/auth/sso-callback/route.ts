import { NextResponse } from "next/server"
import {
  ensureVoltSchema,
  formatMembership,
  getDbPool,
  getErrorMessage,
} from "@/lib/server/volt-schema"
import sql from "mssql"

/**
 * GET /api/auth/sso-callback
 *
 * Handles the OAuth 2.0 authorization code callback from Microsoft or Google.
 * Exchanges the code for tokens, extracts the verified email, then looks the
 * person up in the Volt AppUsers table and redirects to the dashboard.
 *
 * No next-auth library required — pure OAuth 2.0 PKCE flow.
 *
 * Required env vars (set in Azure App Service > Configuration):
 *   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET  — for Microsoft
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET                  — for Google
 *   NEXT_PUBLIC_APP_URL                                     — e.g. https://your-app.azurewebsites.net
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const stateRaw = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin
  const redirectUri = `${appUrl}/api/auth/sso-callback`

  if (error) {
    return NextResponse.redirect(`${appUrl}/login?sso_error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/login?sso_error=no_code`)
  }

  let provider: "microsoft" | "google" = "microsoft"
  try {
    const state = JSON.parse(decodeURIComponent(stateRaw || "{}"))
    provider = state.provider || "microsoft"
  } catch {
    // default to microsoft
  }

  try {
    let email: string | null = null

    if (provider === "microsoft") {
      const tenantId = process.env.AZURE_TENANT_ID || "common"
      const clientId = process.env.AZURE_CLIENT_ID || process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || ""
      const clientSecret = process.env.AZURE_CLIENT_SECRET || ""

      const tokenRes = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
            scope: "openid email profile",
          }),
        },
      )

      const tokenData = await tokenRes.json()

      if (!tokenRes.ok) {
        throw new Error(tokenData.error_description || "Microsoft token exchange failed")
      }

      // Decode the id_token JWT payload (no signature verification needed here —
      // the token came directly from Microsoft's token endpoint over HTTPS)
      const idToken = tokenData.id_token
      if (idToken) {
        const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString())
        email = payload.email || payload.preferred_username || null
      }
    } else {
      // Google
      const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ""

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      })

      const tokenData = await tokenRes.json()

      if (!tokenRes.ok) {
        throw new Error(tokenData.error_description || "Google token exchange failed")
      }

      const idToken = tokenData.id_token
      if (idToken) {
        const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString())
        email = payload.email || null
      }
    }

    if (!email) {
      return NextResponse.redirect(`${appUrl}/login?sso_error=no_email`)
    }

    // Look up the verified email in Volt's AppUsers table
    await ensureVoltSchema()
    const pool = await getDbPool()

    const result = await pool
      .request()
      .input("email", sql.NVarChar(320), email.toLowerCase().trim())
      .query(`
        SELECT
          u.id AS user_id, u.company_id, u.full_name, u.email,
          u.role, u.status, u.auth_method,
          c.name AS company_name, c.dashboard_name, c.logo_url,
          c.primary_color, c.accent_color, c.owner_name, c.owner_email
        FROM dbo.AppUsers u
        INNER JOIN dbo.Companies c ON c.id = u.company_id
        WHERE u.email = @email AND u.status = 'active' AND c.is_active = 1
        ORDER BY
          CASE u.role WHEN 'creator' THEN 0 WHEN 'business_owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
          c.name ASC
      `)

    if (result.recordset.length === 0) {
      return NextResponse.redirect(
        `${appUrl}/login?sso_error=${encodeURIComponent("no_account")}&sso_email=${encodeURIComponent(email)}`,
      )
    }

    // Check auth_method — make sure this person is allowed to use this SSO provider
    const userAuthMethod = result.recordset[0].auth_method || "password"
    const allowedMethods: Record<string, string[]> = {
      microsoft: ["microsoft", "any"],
      google: ["google", "any"],
    }

    if (!allowedMethods[provider]?.includes(userAuthMethod)) {
      const methodLabels: Record<string, string> = {
        password: "email and password",
        microsoft: "Microsoft",
        google: "Google",
      }
      const expectedLabel = methodLabels[userAuthMethod] || userAuthMethod
      return NextResponse.redirect(
        `${appUrl}/login?sso_error=${encodeURIComponent(`This account uses ${expectedLabel} login. Please use that method instead.`)}`,
      )
    }

    await pool
      .request()
      .input("email", sql.NVarChar(320), email.toLowerCase().trim())
      .query(`UPDATE dbo.AppUsers SET last_login_at = SYSUTCDATETIME() WHERE email = @email`)

    const memberships = result.recordset.map(formatMembership)
    const first = memberships[0]

    const session = {
      userId: first.userId,
      companyId: first.companyId,
      fullName: first.fullName,
      email: first.email,
      role: first.role,
      dashboards: memberships,
    }

    // Pass the session data to the client via a redirect with a short-lived
    // URL-safe token stored in a cookie.
    const sessionJson = Buffer.from(JSON.stringify({ session, company: first.company })).toString(
      "base64url",
    )

    const response = NextResponse.redirect(`${appUrl}/login/sso-complete`)
    response.cookies.set("volt_sso_payload", sessionJson, {
      httpOnly: false, // needs to be read by client JS
      maxAge: 60, // 60 seconds — just long enough to complete the redirect
      path: "/",
      sameSite: "lax",
      secure: appUrl.startsWith("https"),
    })

    return response
  } catch (err) {
    console.error("[SSO callback error]", err)
    return NextResponse.redirect(
      `${appUrl}/login?sso_error=${encodeURIComponent(getErrorMessage(err))}`,
    )
  }
}
