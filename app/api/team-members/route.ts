import { NextResponse } from "next/server"
import sql from "mssql"
import { ensureVoltSchema, getDbPool, getErrorMessage } from "@/lib/server/volt-schema"

function getCompanyId(request: Request) {
  const url = new URL(request.url)
  return Number(url.searchParams.get("companyId") || request.headers.get("x-company-id") || 0)
}

function formatMember(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
  }
}

export async function GET(request: Request) {
  try {
    await ensureVoltSchema()
    const companyId = getCompanyId(request)

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 })
    }

    const pool = await getDbPool()
    const result = await pool.request().input("company_id", sql.Int, companyId).query(`
      SELECT id, company_id, full_name, email, role, status
      FROM dbo.AppUsers
      WHERE company_id = @company_id
        AND status = 'active'
      ORDER BY full_name ASC
    `)

    return NextResponse.json(result.recordset.map(formatMember))
  } catch (error) {
    console.error("Failed to load team members:", error)
    return NextResponse.json(
      { error: "Failed to load team members", details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
