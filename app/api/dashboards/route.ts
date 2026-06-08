import { NextResponse } from "next/server"
import sql from "mssql"
import {
  cleanHex,
  ensureVoltSchema,
  formatCompany,
  formatMembership,
  getDbPool,
  getErrorMessage,
} from "@/lib/server/volt-schema"

export async function GET(request: Request) {
  try {
    await ensureVoltSchema()

    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get("userId") || request.headers.get("x-user-id") || 0)
    const email = String(searchParams.get("email") || request.headers.get("x-user-email") || "").trim().toLowerCase()
    const creator = searchParams.get("creator") === "true"

    const pool = await getDbPool()

    if (creator) {
      const result = await pool.request().query(`
        SELECT
          c.id,
          c.name,
          c.dashboard_name,
          c.logo_url,
          c.primary_color,
          c.accent_color,
          c.owner_name,
          c.owner_email,
          c.created_at,
          COUNT(DISTINCT u.id) AS user_count,
          COUNT(DISTINCT t.id) AS task_count,
          COUNT(DISTINCT tk.id) AS ticket_count
        FROM dbo.Companies c
        LEFT JOIN dbo.AppUsers u ON u.company_id = c.id
        LEFT JOIN dbo.Tasks t ON t.company_id = c.id
        LEFT JOIN dbo.Tickets tk ON tk.company_id = c.id
        WHERE c.is_active = 1
        GROUP BY
          c.id,
          c.name,
          c.dashboard_name,
          c.logo_url,
          c.primary_color,
          c.accent_color,
          c.owner_name,
          c.owner_email,
          c.created_at
        ORDER BY c.created_at DESC
      `)

      return NextResponse.json(result.recordset)
    }

    if (!userId && !email) {
      return NextResponse.json({ error: "userId or email is required" }, { status: 400 })
    }

    const result = await pool
      .request()
      .input("user_id", sql.Int, userId || null)
      .input("email", sql.NVarChar(320), email || null)
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
        WHERE u.status = 'active'
          AND c.is_active = 1
          AND (
            (@user_id IS NOT NULL AND u.id = @user_id)
            OR (@email IS NOT NULL AND u.email = @email)
          )
        ORDER BY c.name ASC
      `)

    return NextResponse.json(result.recordset.map(formatMembership))
  } catch (error) {
    console.error("Failed to load dashboards:", error)
    return NextResponse.json(
      { error: "Failed to load dashboards", details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    await ensureVoltSchema()

    const body = await request.json()

    const creatorUserId = Number(body.creatorUserId || request.headers.get("x-user-id") || 0)
    const creatorEmail = String(body.creatorEmail || request.headers.get("x-user-email") || "").trim().toLowerCase()
    const companyName = String(body.companyName || "").trim()
    const dashboardName = String(body.dashboardName || "").trim()
    const ownerName = String(body.ownerName || body.creatorName || "").trim()
    const ownerEmail = String(body.ownerEmail || creatorEmail || "").trim().toLowerCase()
    const logoUrl = String(body.logoUrl || "").trim() || null
    const primaryColor = cleanHex(body.primaryColor, "#22c55e")
    const accentColor = cleanHex(body.accentColor, "#8b5cf6")

    if (!creatorUserId || !companyName || !dashboardName || !ownerName || !ownerEmail) {
      return NextResponse.json(
        { error: "creatorUserId, company name, dashboard name, owner name and owner email are required" },
        { status: 400 }
      )
    }

    const pool = await getDbPool()

    const creatorResult = await pool
      .request()
      .input("creator_user_id", sql.Int, creatorUserId)
      .query(`
        SELECT TOP 1 id, full_name, email, password_hash, password_salt, role
        FROM dbo.AppUsers
        WHERE id = @creator_user_id
          AND status = 'active'
      `)

    if (creatorResult.recordset.length === 0) {
      return NextResponse.json({ error: "Creator user not found" }, { status: 404 })
    }

    const creator = creatorResult.recordset[0]

    if (!["creator", "business_owner", "admin"].includes(String(creator.role))) {
      return NextResponse.json({ error: "You do not have permission to create dashboards" }, { status: 403 })
    }

    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const companyResult = await new sql.Request(transaction)
        .input("name", sql.NVarChar(200), companyName)
        .input("dashboard_name", sql.NVarChar(200), dashboardName)
        .input("logo_url", sql.NVarChar(1000), logoUrl)
        .input("primary_color", sql.NVarChar(20), primaryColor)
        .input("accent_color", sql.NVarChar(20), accentColor)
        .input("owner_name", sql.NVarChar(200), ownerName)
        .input("owner_email", sql.NVarChar(320), ownerEmail)
        .input("created_by_user_id", sql.Int, creatorUserId)
        .query(`
          INSERT INTO dbo.Companies (
            name,
            dashboard_name,
            logo_url,
            primary_color,
            accent_color,
            owner_name,
            owner_email,
            created_by_user_id,
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
            @created_by_user_id,
            'client',
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
          )
        `)

      const company = companyResult.recordset[0]

      const role = creator.role === "creator" ? "creator" : "business_owner"

      const userResult = await new sql.Request(transaction)
        .input("company_id", sql.Int, company.id)
        .input("full_name", sql.NVarChar(200), ownerName)
        .input("email", sql.NVarChar(320), ownerEmail)
        .input("role", sql.NVarChar(50), role)
        .input("password_hash", sql.NVarChar(300), creator.password_hash)
        .input("password_salt", sql.NVarChar(100), creator.password_salt)
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

      await transaction.commit()

      return NextResponse.json(
        {
          ...formatCompany(company),
          ownerUserId: userResult.recordset[0].id,
        },
        { status: 201 }
      )
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    console.error("Failed to create dashboard:", error)
    return NextResponse.json(
      { error: "Failed to create dashboard", details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureVoltSchema()

    const body = await request.json()

    const companyId = Number(body.companyId || body.id || 0)
    const updatedByUserId = Number(
      body.updatedByUserId || request.headers.get("x-user-id") || 0
    )
    const updatedByEmail = String(
      body.updatedByEmail || request.headers.get("x-user-email") || ""
    )
      .trim()
      .toLowerCase()

    const companyName = String(body.companyName || body.name || "").trim()
    const dashboardName = String(body.dashboardName || "").trim()
    const logoUrl = String(body.logoUrl || "").trim() || null
    const primaryColor = cleanHex(body.primaryColor, "#22c55e")
    const accentColor = cleanHex(body.accentColor, "#8b5cf6")

    if (!companyId || !updatedByUserId) {
      return NextResponse.json(
        { error: "companyId and updatedByUserId are required" },
        { status: 400 }
      )
    }

    if (!companyName || !dashboardName) {
      return NextResponse.json(
        { error: "Company name and dashboard name are required" },
        { status: 400 }
      )
    }

    const pool = await getDbPool()

    const permissionResult = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, updatedByUserId)
      .input("email", sql.NVarChar(320), updatedByEmail || null)
      .query(`
        SELECT TOP 1 id, role
        FROM dbo.AppUsers
        WHERE company_id = @company_id
          AND status = 'active'
          AND (
            id = @user_id
            OR (@email IS NOT NULL AND email = @email)
          )
      `)

    if (permissionResult.recordset.length === 0) {
      return NextResponse.json(
        { error: "You do not have access to this dashboard" },
        { status: 403 }
      )
    }

    const role = String(permissionResult.recordset[0].role)

    if (!["creator", "business_owner", "admin"].includes(role)) {
      return NextResponse.json(
        { error: "You do not have permission to edit this dashboard" },
        { status: 403 }
      )
    }

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
          AND is_active = 1
      `)

    if (result.recordset.length === 0) {
      return NextResponse.json(
        { error: "Dashboard not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(formatCompany(result.recordset[0]))
  } catch (error) {
    console.error("Failed to update dashboard:", error)
    return NextResponse.json(
      { error: "Failed to update dashboard", details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureVoltSchema()

    const body = await request.json().catch(() => null)

    const { searchParams } = new URL(request.url)

    const companyId = Number(
      body?.companyId || body?.id || searchParams.get("companyId") || 0
    )

    const deletedByUserId = Number(
      body?.deletedByUserId ||
        searchParams.get("deletedByUserId") ||
        request.headers.get("x-user-id") ||
        0
    )

    const deletedByEmail = String(
      body?.deletedByEmail ||
        searchParams.get("deletedByEmail") ||
        request.headers.get("x-user-email") ||
        ""
    )
      .trim()
      .toLowerCase()

    if (!companyId || !deletedByUserId) {
      return NextResponse.json(
        { error: "companyId and deletedByUserId are required" },
        { status: 400 }
      )
    }

    const pool = await getDbPool()

    const permissionResult = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, deletedByUserId)
      .input("email", sql.NVarChar(320), deletedByEmail || null)
      .query(`
        SELECT TOP 1 id, role
        FROM dbo.AppUsers
        WHERE company_id = @company_id
          AND status = 'active'
          AND (
            id = @user_id
            OR (@email IS NOT NULL AND email = @email)
          )
      `)

    if (permissionResult.recordset.length === 0) {
      return NextResponse.json(
        { error: "You do not have access to this dashboard" },
        { status: 403 }
      )
    }

    const role = String(permissionResult.recordset[0].role)

    if (!["creator", "business_owner", "admin"].includes(role)) {
      return NextResponse.json(
        { error: "You do not have permission to delete this dashboard" },
        { status: 403 }
      )
    }

    const activeDashboardCount = await pool
      .request()
      .input("user_id", sql.Int, deletedByUserId)
      .input("email", sql.NVarChar(320), deletedByEmail || null)
      .query(`
        SELECT COUNT(DISTINCT c.id) AS dashboard_count
        FROM dbo.AppUsers u
        INNER JOIN dbo.Companies c ON c.id = u.company_id
        WHERE u.status = 'active'
          AND c.is_active = 1
          AND (
            u.id = @user_id
            OR (@email IS NOT NULL AND u.email = @email)
          )
      `)

    const dashboardCount = Number(
      activeDashboardCount.recordset[0]?.dashboard_count || 0
    )

    if (dashboardCount <= 1) {
      return NextResponse.json(
        {
          error:
            "You cannot delete your last active dashboard. Create or join another dashboard first.",
        },
        { status: 400 }
      )
    }

    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const deleteResult = await new sql.Request(transaction)
        .input("company_id", sql.Int, companyId)
        .query(`
          UPDATE dbo.Companies
          SET
            is_active = 0,
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
            AND is_active = 1
        `)

      if (deleteResult.recordset.length === 0) {
        await transaction.rollback()
        return NextResponse.json(
          { error: "Dashboard not found" },
          { status: 404 }
        )
      }

      await new sql.Request(transaction)
        .input("company_id", sql.Int, companyId)
        .query(`
          UPDATE dbo.AppUsers
          SET
            status = 'inactive',
            updated_at = SYSUTCDATETIME()
          WHERE company_id = @company_id
            AND status = 'active'
        `)

      await transaction.commit()

      return NextResponse.json({
        success: true,
        deletedDashboard: formatCompany(deleteResult.recordset[0]),
      })
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    console.error("Failed to delete dashboard:", error)
    return NextResponse.json(
      { error: "Failed to delete dashboard", details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

