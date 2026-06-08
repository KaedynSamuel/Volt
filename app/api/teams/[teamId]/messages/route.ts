import { NextResponse } from "next/server"
import sql from "mssql"
import { ensureVoltSchema, getDbPool, getErrorMessage } from "@/lib/server/volt-schema"

function getCompanyId(request: Request, body?: any) {
  const url = new URL(request.url)
  return Number(body?.companyId || url.searchParams.get("companyId") || request.headers.get("x-company-id") || 0)
}
function getUserId(request: Request, body?: any) {
  const url = new URL(request.url)
  return Number(body?.userId || url.searchParams.get("userId") || request.headers.get("x-user-id") || 0)
}
async function canOpenTeam(pool: sql.ConnectionPool, teamId: number, companyId: number, userId: number) {
  const result = await pool.request()
    .input("team_id", sql.Int, teamId)
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT TOP 1 u.role, t.security_key
      FROM dbo.Teams t
      INNER JOIN dbo.AppUsers u ON u.company_id = t.company_id AND u.id = @user_id AND u.status = 'active'
      WHERE t.id = @team_id AND t.company_id = @company_id AND t.status = 'active'
        AND (u.role IN ('admin','creator') OR EXISTS (SELECT 1 FROM dbo.TeamMembers tm WHERE tm.team_id = t.id AND tm.user_id = @user_id))
    `)
  return result.recordset[0]
}

export async function GET(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    await ensureVoltSchema()
    const { teamId: teamIdValue } = await params
    const teamId = Number(teamIdValue)
    const companyId = getCompanyId(request)
    const userId = getUserId(request)
    const pool = await getDbPool()
    const access = await canOpenTeam(pool, teamId, companyId, userId)
    if (!access) return NextResponse.json({ error: "You are not a member of this team" }, { status: 403 })

    const result = await pool.request()
      .input("team_id", sql.Int, teamId)
      .input("company_id", sql.Int, companyId)
      .query(`
        SELECT TOP 100 m.id, m.team_id, m.sender_user_id, u.full_name AS sender_name, m.encrypted_body, m.iv, m.created_at
        FROM dbo.TeamMessages m
        INNER JOIN dbo.AppUsers u ON u.id = m.sender_user_id
        WHERE m.team_id = @team_id AND m.company_id = @company_id
        ORDER BY m.created_at ASC
      `)

    return NextResponse.json({ securityKey: access.security_key, messages: result.recordset.map((row:any)=>({ id: row.id, teamId: row.team_id, senderUserId: row.sender_user_id, senderName: row.sender_name, encryptedBody: row.encrypted_body, iv: row.iv, createdAt: row.created_at })) })
  } catch (error) {
    console.error("Failed to load team messages:", error)
    return NextResponse.json({ error: "Failed to load team messages", details: getErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    await ensureVoltSchema()
    const { teamId: teamIdValue } = await params
    const teamId = Number(teamIdValue)
    const body = await request.json()
    const companyId = getCompanyId(request, body)
    const userId = getUserId(request, body)
    const encryptedBody = String(body.encryptedBody || "")
    const iv = String(body.iv || "")
    if (!teamId || !companyId || !userId || !encryptedBody || !iv) return NextResponse.json({ error: "Missing encrypted message data" }, { status: 400 })
    const pool = await getDbPool()
    const access = await canOpenTeam(pool, teamId, companyId, userId)
    if (!access) return NextResponse.json({ error: "You are not a member of this team" }, { status: 403 })
    const result = await pool.request()
      .input("team_id", sql.Int, teamId)
      .input("company_id", sql.Int, companyId)
      .input("sender_user_id", sql.Int, userId)
      .input("encrypted_body", sql.NVarChar(sql.MAX), encryptedBody)
      .input("iv", sql.NVarChar(80), iv)
      .query(`
        INSERT INTO dbo.TeamMessages (team_id, company_id, sender_user_id, encrypted_body, iv, created_at)
        OUTPUT inserted.id, inserted.team_id, inserted.sender_user_id, inserted.encrypted_body, inserted.iv, inserted.created_at
        VALUES (@team_id, @company_id, @sender_user_id, @encrypted_body, @iv, SYSUTCDATETIME())
      `)
    return NextResponse.json(result.recordset[0], { status: 201 })
  } catch (error) {
    console.error("Failed to send team message:", error)
    return NextResponse.json({ error: "Failed to send team message", details: getErrorMessage(error) }, { status: 500 })
  }
}
