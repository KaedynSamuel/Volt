import { NextResponse } from "next/server"
import sql from "mssql"
import {
  ensureVoltSchema,
  formatMembership,
  getDbPool,
  getErrorMessage,
  verifyPassword,
} from "@/lib/server/volt-schema"

export async function POST(request: Request) {
  try {
    await ensureVoltSchema()

    const body = await request.json()
    const email = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "").trim()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
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
          u.password_hash,
          u.password_salt,
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
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const matchingUser = result.recordset.find((row: any) =>
      verifyPassword(password, row.password_hash, row.password_salt)
    )

    if (!matchingUser) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
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
    const first = formatMembership(matchingUser)

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
    console.error("Login failed:", error)
    return NextResponse.json(
      { error: "Login failed", details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
