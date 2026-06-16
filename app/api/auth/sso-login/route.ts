import { NextResponse } from "next/server"
import sql from "mssql"
import {
  ensureVoltSchema,
  formatMembership,
  getDbPool,
  getErrorMessage,
} from "@/lib/server/volt-schema"

/**
 * POST /api/auth/sso-login
 *
 * Body: { email: string }
 *
 * Called by the login page after a successful "Continue with Microsoft" or
 * "Continue with Google" sign-in. The OAuth provider has already verified
 * that the person owns this email address — this endpoint simply looks up
 * the matching Volt account(s) (the same AppUsers table used for password
 * login) and, if found, returns the normal Volt session payload.
 *
 * If no Volt account exists for the email yet, this returns 404 so the
 * client can show a friendly "ask your admin to add you" message. Volt
 * accounts are still created by a company admin (Team page / Setup), but
 * once created with the person's real Microsoft/Google/work email, that
 * person can sign in instantly with this flow — no password needed.
 */
export async function POST(request: Request) {
  try {
    await ensureVoltSchema()

    const body = await request.json().catch(() => ({}))
    const email = String(body.email || "").trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const pool = await getDbPool()

    const result = await pool
      .request()
      .input("email", sql.NVarChar(320), email)
      .query(`
        SELECT
          u.id AS user_id,
          u.company_id,
          u.full_name,
          u.email,
          u.role,
          u.status,
          c.name AS company_name,
          c.dashboard_name,
          c.logo_url,
          c.primary_color,
          c.accent_color,
          c.owner_name,
          c.owner_email
        FROM dbo.AppUsers u
        INNER JOIN dbo.Companies c ON c.id = u.company_id
        WHERE u.email = @email
          AND u.status = 'active'
          AND c.is_active = 1
        ORDER BY
          CASE u.role
            WHEN 'creator' THEN 0
            WHEN 'business_owner' THEN 1
            WHEN 'admin' THEN 2
            ELSE 3
          END,
          c.name ASC
      `)

    if (result.recordset.length === 0) {
      return NextResponse.json(
        {
          error: "no_account",
          message: `No Volt account is set up for ${email} yet. Ask your company admin to add this email address on the Team page, then try again.`,
        },
        { status: 404 },
      )
    }

    await pool
      .request()
      .input("email", sql.NVarChar(320), email)
      .query(`
        UPDATE dbo.AppUsers
        SET last_login_at = SYSUTCDATETIME()
        WHERE email = @email
      `)

    const memberships = result.recordset.map(formatMembership)
    const first = memberships[0]

    return NextResponse.json({
      session: {
        userId: first.userId,
        companyId: first.companyId,
        fullName: first.fullName,
        email: first.email,
        role: first.role,
        dashboards: memberships,
      },
      company: first.company,
      dashboards: memberships,
    })
  } catch (error) {
    console.error("SSO login failed:", error)
    return NextResponse.json(
      { error: "Login failed", details: getErrorMessage(error) },
      { status: 500 },
    )
  }
}
