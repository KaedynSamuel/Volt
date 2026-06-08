import { NextResponse } from "next/server"
import sql from "mssql"
import {
  cleanHex,
  ensureVoltSchema,
  formatCompany,
  getDbPool,
  getErrorMessage,
  hashPassword,
} from "@/lib/server/volt-schema"

export async function GET(request: Request) {
  try {
    await ensureVoltSchema()

    const { searchParams } = new URL(request.url)
    const companyId = Number(searchParams.get("companyId"))

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 })
    }

    const pool = await getDbPool()

    const result = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .query(`
        SELECT TOP 1
          id,
          name,
          dashboard_name,
          logo_url,
          primary_color,
          accent_color,
          owner_name,
          owner_email,
          created_at
        FROM dbo.Companies
        WHERE id = @company_id
          AND is_active = 1
      `)

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: "Company dashboard not found" }, { status: 404 })
    }

    return NextResponse.json(formatCompany(result.recordset[0]))
  } catch (error) {
    console.error("Failed to load company settings:", error)
    return NextResponse.json(
      { error: "Failed to load company settings", details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    await ensureVoltSchema()

    const body = await request.json()

    const companyName = String(body.companyName || "").trim()
    const dashboardName = String(body.dashboardName || "").trim()
    const ownerName = String(body.ownerName || "").trim()
    const ownerEmail = String(body.ownerEmail || "").trim().toLowerCase()
    const ownerPassword = String(body.ownerPassword || "").trim()
    const logoUrl = String(body.logoUrl || "").trim() || null
    const primaryColor = cleanHex(body.primaryColor, "#22c55e")
    const accentColor = cleanHex(body.accentColor, "#8b5cf6")
    const creatorAccount = Boolean(body.creatorAccount)
    const ownerRole = creatorAccount ? "creator" : "business_owner"

    if (!companyName || !dashboardName || !ownerName || !ownerEmail || !ownerPassword) {
      return NextResponse.json(
        { error: "Company name, dashboard name, owner name, owner email, and owner password are required." },
        { status: 400 }
      )
    }

    const pool = await getDbPool()
    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const password = hashPassword(ownerPassword)

      const companyResult = await new sql.Request(transaction)
        .input("name", sql.NVarChar(200), companyName)
        .input("dashboard_name", sql.NVarChar(200), dashboardName)
        .input("logo_url", sql.NVarChar(1000), logoUrl)
        .input("primary_color", sql.NVarChar(20), primaryColor)
        .input("accent_color", sql.NVarChar(20), accentColor)
        .input("owner_name", sql.NVarChar(200), ownerName)
        .input("owner_email", sql.NVarChar(320), ownerEmail)
        .query(`
          INSERT INTO dbo.Companies (
            name,
            dashboard_name,
            logo_url,
            primary_color,
            accent_color,
            owner_name,
            owner_email,
            dashboard_type,
            created_at,
            updated_at
          )
          OUTPUT
            inserted.id,
            inserted.name,
            inserted.dashboard_name,
            inserted.logo_url,
            inserted.primary_color,
            inserted.accent_color,
            inserted.owner_name,
            inserted.owner_email,
            inserted.created_at
          VALUES (
            @name,
            @dashboard_name,
            @logo_url,
            @primary_color,
            @accent_color,
            @owner_name,
            @owner_email,
            'client',
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
          )
        `)

      const company = companyResult.recordset[0]

      const userResult = await new sql.Request(transaction)
        .input("company_id", sql.Int, company.id)
        .input("full_name", sql.NVarChar(200), ownerName)
        .input("email", sql.NVarChar(320), ownerEmail)
        .input("role", sql.NVarChar(50), ownerRole)
        .input("password_hash", sql.NVarChar(300), password.hash)
        .input("password_salt", sql.NVarChar(100), password.salt)
        .query(`
          INSERT INTO dbo.AppUsers (
            company_id,
            full_name,
            email,
            role,
            status,
            password_hash,
            password_salt,
            created_at,
            updated_at
          )
          OUTPUT inserted.id
          VALUES (
            @company_id,
            @full_name,
            @email,
            @role,
            'active',
            @password_hash,
            @password_salt,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
          )
        `)

      const ownerUserId = userResult.recordset[0].id

      await new sql.Request(transaction)
        .input("company_id", sql.Int, company.id)
        .input("created_by_user_id", sql.Int, ownerUserId)
        .query(`
          UPDATE dbo.Companies
          SET created_by_user_id = @created_by_user_id
          WHERE id = @company_id
        `)

      // Access codes removed: admins now create users directly from the Team page.

      await transaction.commit()

      return NextResponse.json(
        {
          ...formatCompany(company),
          ownerUserId,
        },
        { status: 201 }
      )
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    console.error("Failed to save company setup:", error)
    return NextResponse.json(
      { error: "Failed to save company setup", details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureVoltSchema()

    const body = await request.json()
    const companyId = Number(body.companyId)
    const companyName = String(body.companyName || "").trim()
    const dashboardName = String(body.dashboardName || "").trim()
    const logoUrl = String(body.logoUrl || "").trim() || null
    const primaryColor = cleanHex(body.primaryColor, "#22c55e")
    const accentColor = cleanHex(body.accentColor, "#8b5cf6")

    if (!companyId || !companyName || !dashboardName) {
      return NextResponse.json(
        { error: "companyId, companyName and dashboardName are required" },
        { status: 400 }
      )
    }

    const pool = await getDbPool()

    const result = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("name", sql.NVarChar(200), companyName)
      .input("dashboard_name", sql.NVarChar(200), dashboardName)
      .input("logo_url", sql.NVarChar(1000), logoUrl)
      .input("primary_color", sql.NVarChar(20), primaryColor)
      .input("accent_color", sql.NVarChar(20), accentColor)
      .query(`
        UPDATE dbo.Companies
        SET
          name = @name,
          dashboard_name = @dashboard_name,
          logo_url = @logo_url,
          primary_color = @primary_color,
          accent_color = @accent_color,
          updated_at = SYSUTCDATETIME()
        OUTPUT
          inserted.id,
          inserted.name,
          inserted.dashboard_name,
          inserted.logo_url,
          inserted.primary_color,
          inserted.accent_color,
          inserted.owner_name,
          inserted.owner_email,
          inserted.created_at
        WHERE id = @company_id
      `)

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    return NextResponse.json(formatCompany(result.recordset[0]))
  } catch (error) {
    console.error("Failed to update company settings:", error)
    return NextResponse.json(
      { error: "Failed to update company settings", details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
