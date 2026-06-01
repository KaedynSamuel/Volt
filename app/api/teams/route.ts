import { NextResponse } from "next/server"
import sql from "mssql"
import {
  ensureVoltSchema,
  getDbPool,
  getErrorMessage,
  makeTeamSecurityKey,
} from "@/lib/server/volt-schema"

function getCompanyId(request: Request, body?: any) {
  const url = new URL(request.url)
  return Number(body?.companyId || url.searchParams.get("companyId") || request.headers.get("x-company-id") || 0)
}

function getUserId(request: Request, body?: any) {
  const url = new URL(request.url)
  return Number(body?.userId || url.searchParams.get("userId") || request.headers.get("x-user-id") || 0)
}

function getTeamId(request: Request, body?: any) {
  const url = new URL(request.url)
  const pathId = url.pathname.split("/").filter(Boolean).pop()
  return Number(body?.teamId || url.searchParams.get("teamId") || pathId || 0)
}

function cleanIds(value: unknown) {
  return Array.isArray(value)
    ? value.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : []
}

function formatTeam(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description,
    securityKey: row.security_key,
    createdByUserId: row.created_by_user_id,
    memberCount: row.member_count ?? 0,
    members: row.members ? JSON.parse(row.members) : [],
    createdAt: row.created_at,
  }
}

async function getRole(pool: sql.ConnectionPool, companyId: number, userId: number) {
  const result = await pool.request()
    .input("company_id", sql.Int, companyId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT TOP 1 role
      FROM dbo.AppUsers
      WHERE id = @user_id AND company_id = @company_id AND status = 'active'
    `)

  return String(result.recordset[0]?.role || "")
}

function isAdmin(role: string) {
  return role === "admin" || role === "creator" || role === "business_owner"
}

async function getTeamById(pool: sql.ConnectionPool, companyId: number, teamId: number) {
  const result = await pool.request()
    .input("company_id", sql.Int, companyId)
    .input("team_id", sql.Int, teamId)
    .query(`
      SELECT
        t.id,
        t.company_id,
        t.name,
        t.description,
        t.security_key,
        t.created_by_user_id,
        t.created_at,
        COUNT(tm.user_id) AS member_count,
        (
          SELECT u.id, u.full_name AS fullName, u.email, u.role
          FROM dbo.TeamMembers tm2
          INNER JOIN dbo.AppUsers u ON u.id = tm2.user_id
          WHERE tm2.team_id = t.id
          ORDER BY u.full_name ASC
          FOR JSON PATH
        ) AS members
      FROM dbo.Teams t
      LEFT JOIN dbo.TeamMembers tm ON tm.team_id = t.id
      WHERE t.company_id = @company_id
        AND t.id = @team_id
        AND t.status = 'active'
      GROUP BY t.id, t.company_id, t.name, t.description, t.security_key, t.created_by_user_id, t.created_at
    `)

  return result.recordset[0] ? formatTeam(result.recordset[0]) : null
}

export async function GET(request: Request) {
  try {
    await ensureVoltSchema()
    const companyId = getCompanyId(request)
    const userId = getUserId(request)

    if (!companyId || !userId) {
      return NextResponse.json({ error: "companyId and userId are required" }, { status: 400 })
    }

    const pool = await getDbPool()
    const role = await getRole(pool, companyId, userId)

    if (!role) {
      return NextResponse.json({ error: "User does not belong to this company" }, { status: 403 })
    }

    const result = await pool.request()
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .input("admin_view", sql.Bit, isAdmin(role) ? 1 : 0)
      .query(`
        SELECT
          t.id,
          t.company_id,
          t.name,
          t.description,
          t.security_key,
          t.created_by_user_id,
          t.created_at,
          COUNT(tm.user_id) AS member_count,
          (
            SELECT u.id, u.full_name AS fullName, u.email, u.role
            FROM dbo.TeamMembers tm2
            INNER JOIN dbo.AppUsers u ON u.id = tm2.user_id
            WHERE tm2.team_id = t.id
            ORDER BY u.full_name ASC
            FOR JSON PATH
          ) AS members
        FROM dbo.Teams t
        LEFT JOIN dbo.TeamMembers tm ON tm.team_id = t.id
        WHERE t.company_id = @company_id
          AND t.status = 'active'
          AND (@admin_view = 1 OR EXISTS (
            SELECT 1 FROM dbo.TeamMembers mytm WHERE mytm.team_id = t.id AND mytm.user_id = @user_id
          ))
        GROUP BY t.id, t.company_id, t.name, t.description, t.security_key, t.created_by_user_id, t.created_at
        ORDER BY t.created_at DESC
      `)

    return NextResponse.json(result.recordset.map(formatTeam))
  } catch (error) {
    console.error("Failed to load teams:", error)
    return NextResponse.json({ error: "Failed to load teams", details: getErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await ensureVoltSchema()
    const body = await request.json()
    const companyId = getCompanyId(request, body)
    const userId = getUserId(request, body)
    const name = String(body.name || "").trim()
    const description = String(body.description || "").trim() || null
    const memberIds = Array.from(new Set([userId, ...cleanIds(body.memberIds)]))

    if (!companyId || !userId || !name) {
      return NextResponse.json({ error: "companyId, userId and team name are required" }, { status: 400 })
    }

    const pool = await getDbPool()
    const role = await getRole(pool, companyId, userId)

    if (!isAdmin(role)) {
      return NextResponse.json({ error: "Only admins and business owners can create teams" }, { status: 403 })
    }

    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const teamResult = await new sql.Request(transaction)
        .input("company_id", sql.Int, companyId)
        .input("name", sql.NVarChar(200), name)
        .input("description", sql.NVarChar(1000), description)
        .input("security_key", sql.NVarChar(200), makeTeamSecurityKey())
        .input("created_by_user_id", sql.Int, userId)
        .query(`
          INSERT INTO dbo.Teams (company_id, name, description, security_key, created_by_user_id, status, created_at, updated_at)
          OUTPUT inserted.id, inserted.company_id, inserted.name, inserted.description, inserted.security_key, inserted.created_by_user_id, inserted.created_at
          VALUES (@company_id, @name, @description, @security_key, @created_by_user_id, 'active', SYSUTCDATETIME(), SYSUTCDATETIME())
        `)

      const team = teamResult.recordset[0]

      for (const memberId of memberIds) {
        await new sql.Request(transaction)
          .input("team_id", sql.Int, team.id)
          .input("company_id", sql.Int, companyId)
          .input("user_id", sql.Int, memberId)
          .input("added_by_user_id", sql.Int, userId)
          .query(`
            IF EXISTS (SELECT 1 FROM dbo.AppUsers WHERE id = @user_id AND company_id = @company_id AND status = 'active')
            AND NOT EXISTS (SELECT 1 FROM dbo.TeamMembers WHERE team_id = @team_id AND user_id = @user_id)
            BEGIN
              INSERT INTO dbo.TeamMembers (team_id, company_id, user_id, added_by_user_id, created_at)
              VALUES (@team_id, @company_id, @user_id, @added_by_user_id, SYSUTCDATETIME())
            END
          `)
      }

      await transaction.commit()
      const createdTeam = await getTeamById(pool, companyId, team.id)
      return NextResponse.json(createdTeam || formatTeam({ ...team, member_count: memberIds.length, members: "[]" }), { status: 201 })
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    console.error("Failed to create team:", error)
    return NextResponse.json({ error: "Failed to create team", details: getErrorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureVoltSchema()
    const body = await request.json()
    const companyId = getCompanyId(request, body)
    const userId = getUserId(request, body)
    const teamId = getTeamId(request, body)
    const name = String(body.name || "").trim()
    const description = String(body.description || "").trim() || null
    const memberIds = Array.from(new Set(cleanIds(body.memberIds)))

    if (!companyId || !userId || !teamId || !name) {
      return NextResponse.json({ error: "companyId, userId, teamId and team name are required" }, { status: 400 })
    }

    const pool = await getDbPool()
    const role = await getRole(pool, companyId, userId)

    if (!isAdmin(role)) {
      return NextResponse.json({ error: "Only admins and business owners can edit teams" }, { status: 403 })
    }

    const existing = await getTeamById(pool, companyId, teamId)
    if (!existing) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      await new sql.Request(transaction)
        .input("company_id", sql.Int, companyId)
        .input("team_id", sql.Int, teamId)
        .input("name", sql.NVarChar(200), name)
        .input("description", sql.NVarChar(1000), description)
        .query(`
          UPDATE dbo.Teams
          SET name = @name,
              description = @description,
              updated_at = SYSUTCDATETIME()
          WHERE id = @team_id
            AND company_id = @company_id
            AND status = 'active'
        `)

      if (Array.isArray(body.memberIds)) {
        await new sql.Request(transaction)
          .input("team_id", sql.Int, teamId)
          .input("company_id", sql.Int, companyId)
          .query(`
            DELETE FROM dbo.TeamMembers
            WHERE team_id = @team_id AND company_id = @company_id
          `)

        for (const memberId of memberIds) {
          await new sql.Request(transaction)
            .input("team_id", sql.Int, teamId)
            .input("company_id", sql.Int, companyId)
            .input("user_id", sql.Int, memberId)
            .input("added_by_user_id", sql.Int, userId)
            .query(`
              IF EXISTS (SELECT 1 FROM dbo.AppUsers WHERE id = @user_id AND company_id = @company_id AND status = 'active')
              AND NOT EXISTS (SELECT 1 FROM dbo.TeamMembers WHERE team_id = @team_id AND user_id = @user_id)
              BEGIN
                INSERT INTO dbo.TeamMembers (team_id, company_id, user_id, added_by_user_id, created_at)
                VALUES (@team_id, @company_id, @user_id, @added_by_user_id, SYSUTCDATETIME())
              END
            `)
        }
      }

      await transaction.commit()
      const updatedTeam = await getTeamById(pool, companyId, teamId)
      return NextResponse.json(updatedTeam)
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    console.error("Failed to update team:", error)
    return NextResponse.json({ error: "Failed to update team", details: getErrorMessage(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureVoltSchema()
    const body = await request.json().catch(() => ({}))
    const companyId = getCompanyId(request, body)
    const userId = getUserId(request, body)
    const teamId = getTeamId(request, body)

    if (!companyId || !userId || !teamId) {
      return NextResponse.json({ error: "companyId, userId and teamId are required" }, { status: 400 })
    }

    const pool = await getDbPool()
    const role = await getRole(pool, companyId, userId)

    if (!isAdmin(role)) {
      return NextResponse.json({ error: "Only admins and business owners can delete teams" }, { status: 403 })
    }

    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      await new sql.Request(transaction)
        .input("company_id", sql.Int, companyId)
        .input("team_id", sql.Int, teamId)
        .query(`
          DELETE FROM dbo.TeamMembers
          WHERE team_id = @team_id AND company_id = @company_id;

          UPDATE dbo.Teams
          SET status = 'deleted', updated_at = SYSUTCDATETIME()
          WHERE id = @team_id AND company_id = @company_id;
        `)

      await transaction.commit()
      return NextResponse.json({ ok: true })
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    console.error("Failed to delete team:", error)
    return NextResponse.json({ error: "Failed to delete team", details: getErrorMessage(error) }, { status: 500 })
  }
}
