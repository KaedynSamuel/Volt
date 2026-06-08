import { NextResponse } from "next/server"
import sql from "mssql"
import { getDbPool } from "@/lib/server/volt-schema"

function getCompanyId(request: Request) {
  const url = new URL(request.url)
  return Number(url.searchParams.get("companyId") || request.headers.get("x-company-id") || 0)
}

function getUserId(request: Request) {
  const url = new URL(request.url)
  return Number(url.searchParams.get("userId") || request.headers.get("x-user-id") || 0)
}

// GET /api/notifications?companyId=X&userId=Y
export async function GET(request: Request) {
  const companyId = getCompanyId(request)
  const userId = getUserId(request)

  if (!companyId || !userId) {
    return NextResponse.json({ error: "companyId and userId are required" }, { status: 400 })
  }

  try {
    const pool = await getDbPool()
    const result = await pool
      .request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT TOP 50
          id,
          type,
          title,
          message,
          related_id AS relatedId,
          is_read AS isRead,
          created_at AS createdAt
        FROM dbo.VoltNotifications
        WHERE company_id = @company_id AND user_id = @user_id
        ORDER BY created_at DESC
      `)

    return NextResponse.json(result.recordset)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH /api/notifications — mark as read
export async function PATCH(request: Request) {
  const companyId = getCompanyId(request)
  const userId = getUserId(request)
  const body = await request.json().catch(() => ({}))

  if (!companyId || !userId) {
    return NextResponse.json({ error: "companyId and userId are required" }, { status: 400 })
  }

  try {
    const pool = await getDbPool()

    if (body.id) {
      await pool
        .request()
        .input("id", sql.Int, Number(body.id))
        .input("user_id", sql.Int, userId)
        .query("UPDATE dbo.VoltNotifications SET is_read = 1 WHERE id = @id AND user_id = @user_id")
    } else {
      // Mark all as read
      await pool
        .request()
        .input("company_id", sql.Int, companyId)
        .input("user_id", sql.Int, userId)
        .query("UPDATE dbo.VoltNotifications SET is_read = 1 WHERE company_id = @company_id AND user_id = @user_id")
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/notifications — delete one or all
export async function DELETE(request: Request) {
  const companyId = getCompanyId(request)
  const userId = getUserId(request)
  const body = await request.json().catch(() => ({}))

  if (!companyId || !userId) {
    return NextResponse.json({ error: "companyId and userId are required" }, { status: 400 })
  }

  try {
    const pool = await getDbPool()

    if (body.clearAll) {
      await pool
        .request()
        .input("company_id", sql.Int, companyId)
        .input("user_id", sql.Int, userId)
        .query("DELETE FROM dbo.VoltNotifications WHERE company_id = @company_id AND user_id = @user_id")
    } else if (body.id) {
      await pool
        .request()
        .input("id", sql.Int, Number(body.id))
        .input("user_id", sql.Int, userId)
        .query("DELETE FROM dbo.VoltNotifications WHERE id = @id AND user_id = @user_id")
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
