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

function getFileId(request: Request) {
  const url = new URL(request.url)
  return Number(url.searchParams.get("fileId") || 0)
}

function isAllowedSafeFile(fileName: string, mimeType: string, fileSize: number, payloadLength: number) {
  const lowerName = fileName.toLowerCase()
  const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".xml"]
  if (!allowedExtensions.some((ext) => lowerName.endsWith(ext))) return "Only images, Word, Excel, PDF, and XML files are allowed."
  if (!fileSize || !payloadLength) return "This file is empty or corrupted."
  if (fileSize > 10 * 1024 * 1024 || payloadLength > 14 * 1024 * 1024) return "File limit is 10MB per upload."
  if (mimeType.length > 200) return "File type is too long."
  return ""
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
        SELECT TOP 100 f.id, f.team_id, f.uploaded_by_user_id, u.full_name AS uploaded_by_name, f.file_name, f.mime_type, f.file_size, f.encrypted_payload, f.iv, f.created_at
        FROM dbo.TeamFiles f
        INNER JOIN dbo.AppUsers u ON u.id = f.uploaded_by_user_id
        WHERE f.team_id = @team_id AND f.company_id = @company_id
        ORDER BY f.created_at DESC
      `)

    return NextResponse.json({ securityKey: access.security_key, files: result.recordset.map((row:any)=>({ id: row.id, teamId: row.team_id, uploadedByUserId: row.uploaded_by_user_id, uploadedByName: row.uploaded_by_name, fileName: row.file_name, mimeType: row.mime_type, fileSize: Number(row.file_size), encryptedPayload: Buffer.from(row.encrypted_payload).toString("base64"), iv: row.iv, createdAt: row.created_at })) })
  } catch (error) {
    console.error("Failed to load team files:", error)
    return NextResponse.json({ error: "Failed to load team files", details: getErrorMessage(error) }, { status: 500 })
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
    const fileName = String(body.fileName || "").replace(/[\\/]/g, "").trim()
    const mimeType = String(body.mimeType || "application/octet-stream").slice(0, 200)
    const encryptedPayload = String(body.encryptedPayload || "")
    const iv = String(body.iv || "")
    const fileSize = Number(body.fileSize || 0)
    if (!teamId || !companyId || !userId || !fileName || !encryptedPayload || !iv) return NextResponse.json({ error: "Missing encrypted file data" }, { status: 400 })
    const pool = await getDbPool()
    const access = await canOpenTeam(pool, teamId, companyId, userId)
    if (!access) return NextResponse.json({ error: "You are not a member of this team" }, { status: 403 })
    const safetyError = isAllowedSafeFile(fileName, mimeType, fileSize, encryptedPayload.length)
    if (safetyError) return NextResponse.json({ error: safetyError }, { status: 400 })
    const payloadBuffer = Buffer.from(encryptedPayload, "base64")
    if (payloadBuffer.length > 10 * 1024 * 1024) return NextResponse.json({ error: "File limit is 10MB per upload" }, { status: 400 })
    const result = await pool.request()
      .input("team_id", sql.Int, teamId)
      .input("company_id", sql.Int, companyId)
      .input("uploaded_by_user_id", sql.Int, userId)
      .input("file_name", sql.NVarChar(260), fileName)
      .input("mime_type", sql.NVarChar(200), mimeType)
      .input("file_size", sql.BigInt, fileSize)
      .input("encrypted_payload", sql.VarBinary(sql.MAX), payloadBuffer)
      .input("iv", sql.NVarChar(80), iv)
      .query(`
        INSERT INTO dbo.TeamFiles (team_id, company_id, uploaded_by_user_id, file_name, mime_type, file_size, encrypted_payload, iv, created_at)
        OUTPUT inserted.id, inserted.team_id, inserted.file_name, inserted.mime_type, inserted.file_size, inserted.iv, inserted.created_at
        VALUES (@team_id, @company_id, @uploaded_by_user_id, @file_name, @mime_type, @file_size, @encrypted_payload, @iv, SYSUTCDATETIME())
      `)
    return NextResponse.json(result.recordset[0], { status: 201 })
  } catch (error) {
    console.error("Failed to upload team file:", error)
    return NextResponse.json({ error: "Failed to upload team file", details: getErrorMessage(error) }, { status: 500 })
  }
}


export async function DELETE(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    await ensureVoltSchema()
    const { teamId: teamIdValue } = await params
    const teamId = Number(teamIdValue)
    const companyId = getCompanyId(request)
    const userId = getUserId(request)
    const fileId = getFileId(request)

    if (!teamId || !companyId || !userId || !fileId) {
      return NextResponse.json({ error: "teamId, companyId, userId and fileId are required" }, { status: 400 })
    }

    const pool = await getDbPool()
    const access = await canOpenTeam(pool, teamId, companyId, userId)
    if (!access) return NextResponse.json({ error: "You are not a member of this team" }, { status: 403 })

    const result = await pool.request()
      .input("id", sql.Int, fileId)
      .input("team_id", sql.Int, teamId)
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .query(`
        DELETE f
        OUTPUT deleted.id
        FROM dbo.TeamFiles f
        INNER JOIN dbo.AppUsers u ON u.id = @user_id AND u.company_id = @company_id AND u.status = 'active'
        WHERE f.id = @id
          AND f.team_id = @team_id
          AND f.company_id = @company_id
          AND (f.uploaded_by_user_id = @user_id OR u.role IN ('admin','business_owner','creator'))
      `)

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: "File not found or you cannot delete this file" }, { status: 404 })
    }

    return NextResponse.json({ success: true, id: fileId })
  } catch (error) {
    console.error("Failed to delete team file:", error)
    return NextResponse.json({ error: "Failed to delete team file", details: getErrorMessage(error) }, { status: 500 })
  }
}
