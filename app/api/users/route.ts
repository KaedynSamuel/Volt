import { NextResponse } from "next/server"
import sql from "mssql"
import { randomBytes, pbkdf2Sync } from "crypto"
import { ensureVoltSchema, getErrorMessage } from "@/lib/server/volt-schema"

const dbConfig: sql.config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER as string,
  database: process.env.SQL_DATABASE,
  port: Number(process.env.SQL_PORT || 1433),
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
}

function getCompanyId(request: Request) {
  const url = new URL(request.url)

  return Number(
    url.searchParams.get("companyId") ||
      request.headers.get("x-company-id") ||
      0
  )
}

function getUserId(request: Request) {
  const url = new URL(request.url)

  return Number(
    url.searchParams.get("userId") ||
      request.headers.get("x-user-id") ||
      0
  )
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const hash = pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex")

  return { salt, hash }
}

function normalizeRole(role: string) {
  const value = String(role || "").toLowerCase().trim()

  if (value === "business_owner") return "business_owner"
  if (value === "admin") return "admin"

  return "employee"
}

function formatUser(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    authMethod: row.auth_method || "password",
    createdAt: row.created_at,
  }
}

async function requireTeamAdmin(
  pool: sql.ConnectionPool,
  companyId: number,
  userId: number
) {
  if (!companyId || !userId) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "companyId and userId are required" },
        { status: 400 }
      ),
    }
  }

  const result = await pool
    .request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT TOP 1 role
      FROM dbo.AppUsers
      WHERE id = @user_id
        AND company_id = @company_id
        AND status = 'active'
    `)

  const role = String(result.recordset[0]?.role || "")

  if (role !== "admin" && role !== "business_owner" && role !== "creator") {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Only admins and business owners can access this admin area" },
        { status: 403 }
      ),
    }
  }

  return {
    allowed: true,
    response: undefined,
  }
}

export async function GET(request: Request) {
  try {
    await ensureVoltSchema()

    const companyId = getCompanyId(request)
    const userId = getUserId(request)

    const pool = await sql.connect(dbConfig)

    const permission = await requireTeamAdmin(pool, companyId, userId)

    if (!permission.allowed) {
      return permission.response
    }

    const result = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .query(`
        SELECT
          id,
          company_id,
          full_name,
          email,
          role,
          status,
          auth_method,
          created_at
        FROM dbo.AppUsers
        WHERE company_id = @company_id
        ORDER BY
          CASE role
            WHEN 'admin' THEN 1
            WHEN 'business_owner' THEN 2
            ELSE 3
          END,
          full_name ASC
      `)

    return NextResponse.json(result.recordset.map(formatUser))
  } catch (error) {
    console.error("Failed to load users:", error)

    return NextResponse.json(
      {
        error: "Failed to load users",
        details: getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    await ensureVoltSchema()

    const companyId = getCompanyId(request)
    const userId = getUserId(request)
    const body = await request.json()

    const fullName = String(body.fullName || "").trim()
    const email = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "").trim()
    const role = normalizeRole(body.role)
    const authMethod = ["password", "microsoft", "google", "any"].includes(body.authMethod)
      ? body.authMethod
      : "password"

    const pool = await sql.connect(dbConfig)

    const permission = await requireTeamAdmin(pool, companyId, userId)

    if (!permission.allowed) {
      return permission.response
    }

    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Full name and email are required" },
        { status: 400 }
      )
    }

    // Password is only required for password-based login
    if (authMethod === "password" && !password) {
      return NextResponse.json(
        { error: "A temporary password is required for password-based login" },
        { status: 400 }
      )
    }

    // For SSO-only users, generate a random unusable password so the column stays NOT NULL
    const passwordData = (authMethod === "password" || authMethod === "any")
      ? hashPassword(password || randomBytes(32).toString("hex"))
      : hashPassword(randomBytes(32).toString("hex"))

    const result = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("full_name", sql.NVarChar, fullName)
      .input("email", sql.NVarChar, email)
      .input("role", sql.NVarChar, role)
      .input("password_hash", sql.NVarChar, passwordData.hash)
      .input("password_salt", sql.NVarChar, passwordData.salt)
      .input("auth_method", sql.NVarChar, authMethod)
      .query(`
        INSERT INTO dbo.AppUsers (
          company_id,
          full_name,
          email,
          role,
          status,
          password_hash,
          password_salt,
          auth_method,
          created_at,
          updated_at
        )
        OUTPUT
          inserted.id,
          inserted.company_id,
          inserted.full_name,
          inserted.email,
          inserted.role,
          inserted.status,
          inserted.auth_method,
          inserted.created_at
        VALUES (
          @company_id,
          @full_name,
          @email,
          @role,
          'active',
          @password_hash,
          @password_salt,
          @auth_method,
          GETDATE(),
          GETDATE()
        )
      `)

    return NextResponse.json(formatUser(result.recordset[0]), { status: 201 })
  } catch (error: any) {
    console.error("Failed to create user:", error)

    const message =
      error?.number === 2627
        ? "A user with this email already exists for this company"
        : "Failed to create user"

    return NextResponse.json(
      {
        error: message,
        details: getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}
export async function DELETE(request: Request) {
  try {
    await ensureVoltSchema()

    const companyId = getCompanyId(request)
    const userId = getUserId(request)
    const url = new URL(request.url)
    const targetId = Number(url.searchParams.get("targetId") || 0)

    if (!targetId) {
      return NextResponse.json({ error: "targetId is required" }, { status: 400 })
    }

    const pool = await sql.connect(dbConfig)
    const permission = await requireTeamAdmin(pool, companyId, userId)
    if (!permission.allowed) return permission.response

    // Soft-delete: mark as deleted instead of removing from DB
    // This preserves task history, audit logs etc.
    await pool.request()
      .input("company_id", sql.Int, companyId)
      .input("target_id", sql.Int, targetId)
      .query(`
        UPDATE dbo.AppUsers
        SET
          status = 'deleted',
          updated_at = GETDATE()
        WHERE id = @target_id
          AND company_id = @company_id
          AND role NOT IN ('business_owner', 'creator')
      `)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete user:", error)
    return NextResponse.json(
      { error: "Failed to delete user", details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureVoltSchema()

    const companyId = getCompanyId(request)
    const userId = getUserId(request)
    const body = await request.json()
    const targetId = Number(body.targetId || 0)

    if (!targetId) {
      return NextResponse.json({ error: "targetId is required" }, { status: 400 })
    }

    const pool = await sql.connect(dbConfig)
    const permission = await requireTeamAdmin(pool, companyId, userId)
    if (!permission.allowed) return permission.response

    const updates: string[] = []
    if (body.fullName) updates.push("full_name = @full_name")
    if (body.role) updates.push("role = @role")
    if (body.status) updates.push("status = @status")
    updates.push("updated_at = GETDATE()")

    const req = pool.request()
      .input("company_id", sql.Int, companyId)
      .input("target_id", sql.Int, targetId)

    if (body.fullName) req.input("full_name", sql.NVarChar, String(body.fullName).trim())
    if (body.role) req.input("role", sql.NVarChar, normalizeRole(body.role))
    if (body.status) req.input("status", sql.NVarChar, String(body.status))

    const result = await req.query(`
      UPDATE dbo.AppUsers
      SET ${updates.join(", ")}
      OUTPUT
        inserted.id,
        inserted.company_id,
        inserted.full_name,
        inserted.email,
        inserted.role,
        inserted.status,
        inserted.created_at
      WHERE id = @target_id
        AND company_id = @company_id
    `)

    if (!result.recordset[0]) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(formatUser(result.recordset[0]))
  } catch (error) {
    console.error("Failed to update user:", error)
    return NextResponse.json(
      { error: "Failed to update user", details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
