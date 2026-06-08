import { NextResponse } from "next/server";
import sql from "mssql";
import { ensureVoltSchema, getDbPool, getErrorMessage } from "@/lib/server/volt-schema";

type RouteContext = {
  params: Promise<{ teamId: string }> | { teamId: string };
};

const allowedWallpapers = new Set(["soft-grid", "volt-glow", "blue-drift", "custom"]);

async function getTeamId(context: RouteContext) {
  const params = await context.params;
  return Number(params.teamId || 0);
}

function getCompanyId(request: Request, body?: any) {
  const url = new URL(request.url);
  return Number(body?.companyId || url.searchParams.get("companyId") || request.headers.get("x-company-id") || 0);
}

function getUserId(request: Request, body?: any) {
  const url = new URL(request.url);
  return Number(body?.userId || url.searchParams.get("userId") || request.headers.get("x-user-id") || 0);
}

async function ensureWallpaperColumns(pool: sql.ConnectionPool) {
  await pool.request().query(`
    IF COL_LENGTH('dbo.Teams', 'chat_wallpaper_type') IS NULL
    BEGIN
      ALTER TABLE dbo.Teams
      ADD chat_wallpaper_type NVARCHAR(30) NOT NULL
        CONSTRAINT DF_Teams_chat_wallpaper_type DEFAULT ('soft-grid');
    END;

    IF COL_LENGTH('dbo.Teams', 'chat_wallpaper_custom_data_url') IS NULL
    BEGIN
      ALTER TABLE dbo.Teams
      ADD chat_wallpaper_custom_data_url NVARCHAR(MAX) NULL;
    END;
  `);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await ensureVoltSchema();

    const teamId = await getTeamId(context);
    const companyId = getCompanyId(request);
    const userId = getUserId(request);

    if (!teamId || !companyId || !userId) {
      return NextResponse.json({ error: "teamId, companyId and userId are required" }, { status: 400 });
    }

    const pool = await getDbPool();
    await ensureWallpaperColumns(pool);

    const result = await pool.request()
      .input("team_id", sql.Int, teamId)
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .query(`
        SELECT TOP 1
          t.chat_wallpaper_type AS wallpaper,
          t.chat_wallpaper_custom_data_url AS customDataUrl
        FROM dbo.Teams t
        WHERE t.id = @team_id
          AND t.company_id = @company_id
          AND EXISTS (
            SELECT 1
            FROM dbo.TeamMembers tm
            WHERE tm.team_id = t.id
              AND tm.user_id = @user_id
          )
      `);

    const row = result.recordset[0];
    return NextResponse.json({
      wallpaper: row?.wallpaper || "soft-grid",
      customDataUrl: row?.customDataUrl || "",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load team wallpaper", details: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    await ensureVoltSchema();

    const teamId = await getTeamId(context);
    const body = await request.json().catch(() => null);
    const companyId = getCompanyId(request, body);
    const userId = getUserId(request, body);
    const wallpaper = String(body?.wallpaper || "soft-grid");
    const customDataUrl = String(body?.customDataUrl || "");

    if (!teamId || !companyId || !userId) {
      return NextResponse.json({ error: "teamId, companyId and userId are required" }, { status: 400 });
    }

    if (!allowedWallpapers.has(wallpaper)) {
      return NextResponse.json({ error: "Invalid wallpaper option" }, { status: 400 });
    }

    if (wallpaper === "custom" && customDataUrl && !customDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Custom wallpaper must be an image data URL" }, { status: 400 });
    }

    if (wallpaper === "custom" && customDataUrl && customDataUrl.length > 2800000) {
      return NextResponse.json({ error: "Wallpaper image is too large" }, { status: 413 });
    }

    const pool = await getDbPool();
    await ensureWallpaperColumns(pool);

    const result = await pool.request()
      .input("team_id", sql.Int, teamId)
      .input("company_id", sql.Int, companyId)
      .input("user_id", sql.Int, userId)
      .input("wallpaper", sql.NVarChar(30), wallpaper)
      .input("custom_data_url", sql.NVarChar(sql.MAX), wallpaper === "custom" ? customDataUrl : null)
      .query(`
        UPDATE t
        SET
          chat_wallpaper_type = @wallpaper,
          chat_wallpaper_custom_data_url = @custom_data_url
        FROM dbo.Teams t
        WHERE t.id = @team_id
          AND t.company_id = @company_id
          AND EXISTS (
            SELECT 1
            FROM dbo.TeamMembers tm
            WHERE tm.team_id = t.id
              AND tm.user_id = @user_id
          );

        SELECT @@ROWCOUNT AS updated;
      `);

    if (!result.recordset[0]?.updated) {
      return NextResponse.json({ error: "Team not found or user is not in this team" }, { status: 404 });
    }

    return NextResponse.json({ success: true, wallpaper, customDataUrl: wallpaper === "custom" ? customDataUrl : "" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save team wallpaper", details: getErrorMessage(error) }, { status: 500 });
  }
}
