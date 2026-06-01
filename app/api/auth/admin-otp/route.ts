import { NextResponse } from "next/server"
import sql from "mssql"
import {
  cleanHex,
  ensureVoltSchema,
  formatCompany,
  getDbPool,
  getErrorMessage,
  hashOtp,
  hashPassword,
  makeOneTimePassword,
} from "@/lib/server/volt-schema"

const OTP_MINUTES = 10
const MAX_ATTEMPTS = 5

export async function POST(request: Request) {
  try {
    await ensureVoltSchema()
    const body = await request.json()
    const action = String(body.action || "request").toLowerCase()
    const email = String(body.email || body.adminEmail || "").trim().toLowerCase()

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid admin email is required" }, { status: 400 })
    }

    const pool = await getDbPool()

    if (action === "request") {
      const otp = makeOneTimePassword()
      await pool.request()
        .input("email", sql.NVarChar(320), email)
        .input("otp_hash", sql.NVarChar(128), hashOtp(otp))
        .input("expires_at", sql.DateTime2, new Date(Date.now() + OTP_MINUTES * 60 * 1000))
        .query(`
          UPDATE dbo.AdminLoginOtps SET status = 'expired' WHERE email = @email AND status = 'active';
          INSERT INTO dbo.AdminLoginOtps (email, otp_hash, status, attempts, expires_at, created_at)
          VALUES (@email, @otp_hash, 'active', 0, @expires_at, SYSUTCDATETIME());
        `)

      return NextResponse.json({
        ok: true,
        message: "OTP created. Connect your email/SMS provider here before production.",
        expiresInMinutes: OTP_MINUTES,
        devOtp: process.env.NODE_ENV === "production" ? undefined : otp,
      })
    }

    if (action !== "verify") {
      return NextResponse.json({ error: "Unsupported OTP action" }, { status: 400 })
    }

    const otp = String(body.otp || "").trim()
    const companyName = String(body.companyName || "").trim()
    const dashboardName = String(body.dashboardName || companyName || "").trim()
    const adminName = String(body.adminName || body.ownerName || "").trim()
    const adminPassword = String(body.adminPassword || body.password || "").trim()
    const logoUrl = String(body.logoUrl || "").trim() || null
    const primaryColor = cleanHex(body.primaryColor, "#22c55e")
    const accentColor = cleanHex(body.accentColor, "#8b5cf6")

    if (!otp || !companyName || !dashboardName || !adminName || adminPassword.length < 8) {
      return NextResponse.json(
        { error: "OTP, company name, dashboard name, admin name, and an 8+ character password are required" },
        { status: 400 }
      )
    }

    const otpResult = await pool.request()
      .input("email", sql.NVarChar(320), email)
      .query(`
        SELECT TOP 1 id, otp_hash, attempts, expires_at
        FROM dbo.AdminLoginOtps
        WHERE email = @email AND status = 'active'
        ORDER BY created_at DESC
      `)

    const row = otpResult.recordset[0]
    if (!row || new Date(row.expires_at).getTime() < Date.now() || Number(row.attempts) >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: "OTP expired or invalid. Request a new OTP." }, { status: 401 })
    }

    if (String(row.otp_hash) !== hashOtp(otp)) {
      await pool.request().input("id", sql.Int, row.id).query(`UPDATE dbo.AdminLoginOtps SET attempts = attempts + 1 WHERE id = @id`)
      return NextResponse.json({ error: "Invalid OTP" }, { status: 401 })
    }

    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const password = hashPassword(adminPassword)
      const companyResult = await new sql.Request(transaction)
        .input("name", sql.NVarChar(200), companyName)
        .input("dashboard_name", sql.NVarChar(200), dashboardName)
        .input("logo_url", sql.NVarChar(1000), logoUrl)
        .input("primary_color", sql.NVarChar(20), primaryColor)
        .input("accent_color", sql.NVarChar(20), accentColor)
        .input("owner_name", sql.NVarChar(200), adminName)
        .input("owner_email", sql.NVarChar(320), email)
        .query(`
          INSERT INTO dbo.Companies (name, dashboard_name, logo_url, primary_color, accent_color, owner_name, owner_email, dashboard_type, created_at, updated_at)
          OUTPUT inserted.id, inserted.name, inserted.dashboard_name, inserted.logo_url, inserted.primary_color, inserted.accent_color, inserted.owner_name, inserted.owner_email, inserted.created_at
          VALUES (@name, @dashboard_name, @logo_url, @primary_color, @accent_color, @owner_name, @owner_email, 'client', SYSUTCDATETIME(), SYSUTCDATETIME())
        `)
      const company = companyResult.recordset[0]
      const userResult = await new sql.Request(transaction)
        .input("company_id", sql.Int, company.id)
        .input("full_name", sql.NVarChar(200), adminName)
        .input("email", sql.NVarChar(320), email)
        .input("password_hash", sql.NVarChar(300), password.hash)
        .input("password_salt", sql.NVarChar(100), password.salt)
        .query(`
          INSERT INTO dbo.AppUsers (company_id, full_name, email, role, status, password_hash, password_salt, created_at, updated_at)
          OUTPUT inserted.id
          VALUES (@company_id, @full_name, @email, 'admin', 'active', @password_hash, @password_salt, SYSUTCDATETIME(), SYSUTCDATETIME())
        `)
      const adminUserId = userResult.recordset[0].id
      await new sql.Request(transaction)
        .input("company_id", sql.Int, company.id)
        .input("created_by_user_id", sql.Int, adminUserId)
        .query(`UPDATE dbo.Companies SET created_by_user_id = @created_by_user_id WHERE id = @company_id`)
      await new sql.Request(transaction)
        .input("id", sql.Int, row.id)
        .query(`UPDATE dbo.AdminLoginOtps SET status = 'used', verified_at = SYSUTCDATETIME() WHERE id = @id`)
      await transaction.commit()
      return NextResponse.json({ ...formatCompany(company), ownerUserId: adminUserId, role: "admin" }, { status: 201 })
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    console.error("Admin OTP flow failed:", error)
    return NextResponse.json({ error: "Admin OTP flow failed", details: getErrorMessage(error) }, { status: 500 })
  }
}
