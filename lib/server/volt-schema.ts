import sql from "mssql"
import { randomBytes, pbkdf2Sync, timingSafeEqual, createHash } from "crypto"

export const dbConfig: sql.config = {
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

let pool: sql.ConnectionPool | null = null
let schemaReady = false

export async function getDbPool() {
  if (pool?.connected) return pool
  pool = await sql.connect(dbConfig)
  return pool
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return "Unknown server error"
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const hash = pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex")
  return { salt, hash }
}

export function verifyPassword(password: string, storedHash: string, storedSalt: string) {
  try {
    const hash = pbkdf2Sync(password, storedSalt, 100000, 64, "sha512").toString("hex")
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"))
  } catch {
    return false
  }
}

export function cleanHex(value: unknown, fallback: string) {
  const color = String(value || "").trim()
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : fallback
}

export function makeOneTimePassword() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function hashOtp(otp: string) {
  return createHash("sha256").update(String(otp).trim()).digest("hex")
}

export function makeTeamSecurityKey() {
  return randomBytes(32).toString("base64url")
}

export function formatCompany(row: any) {
  return {
    id: row.id,
    name: row.name,
    dashboardName: row.dashboard_name,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    createdAt: row.created_at,
  }
}

export function formatMembership(row: any) {
  return {
    userId: row.user_id ?? row.id,
    companyId: row.company_id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    company: {
      id: row.company_id,
      name: row.company_name ?? row.name,
      dashboardName: row.dashboard_name,
      logoUrl: row.logo_url,
      primaryColor: row.primary_color,
      accentColor: row.accent_color,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
    },
  }
}

export async function ensureVoltSchema() {
  if (schemaReady) return

  const pool = await getDbPool()

  await pool.request().query(`
    IF OBJECT_ID('dbo.Companies', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Companies (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        name NVARCHAR(200) NOT NULL,
        dashboard_name NVARCHAR(200) NOT NULL,
        logo_url NVARCHAR(1000) NULL,
        primary_color NVARCHAR(20) NOT NULL DEFAULT '#22c55e',
        accent_color NVARCHAR(20) NOT NULL DEFAULT '#8b5cf6',
        owner_name NVARCHAR(200) NOT NULL,
        owner_email NVARCHAR(320) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF COL_LENGTH('dbo.Companies', 'created_by_user_id') IS NULL
      ALTER TABLE dbo.Companies ADD created_by_user_id INT NULL;

    IF COL_LENGTH('dbo.Companies', 'dashboard_type') IS NULL
      ALTER TABLE dbo.Companies ADD dashboard_type NVARCHAR(50) NOT NULL CONSTRAINT DF_Companies_dashboard_type DEFAULT 'client';

    IF COL_LENGTH('dbo.Companies', 'is_active') IS NULL
      ALTER TABLE dbo.Companies ADD is_active BIT NOT NULL CONSTRAINT DF_Companies_is_active DEFAULT 1;

    IF OBJECT_ID('dbo.AppUsers', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AppUsers (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        company_id INT NOT NULL,
        full_name NVARCHAR(200) NOT NULL,
        email NVARCHAR(320) NOT NULL,
        role NVARCHAR(50) NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'active',
        password_hash NVARCHAR(300) NOT NULL,
        password_salt NVARCHAR(100) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF COL_LENGTH('dbo.AppUsers', 'last_login_at') IS NULL
      ALTER TABLE dbo.AppUsers ADD last_login_at DATETIME2 NULL;

    IF COL_LENGTH('dbo.AppUsers', 'auth_method') IS NULL
      ALTER TABLE dbo.AppUsers ADD auth_method NVARCHAR(50) NOT NULL CONSTRAINT DF_AppUsers_auth_method DEFAULT 'password';

    IF OBJECT_ID('dbo.AccessCodes', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AccessCodes (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        company_id INT NOT NULL,
        code NVARCHAR(80) NOT NULL UNIQUE,
        role NVARCHAR(50) NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'active',
        created_by_user_id INT NULL,
        used_by_user_id INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        used_at DATETIME2 NULL,
        expires_at DATETIME2 NULL
      );
    END;

    IF OBJECT_ID('dbo.Tasks', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Tasks (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        company_id INT NOT NULL,
        title NVARCHAR(250) NOT NULL,
        description NVARCHAR(MAX) NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        priority NVARCHAR(50) NOT NULL DEFAULT 'medium',
        assignee_name NVARCHAR(200) NULL,
        due_date DATE NULL,
        tags NVARCHAR(1000) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF COL_LENGTH('dbo.Tasks', 'company_id') IS NULL
      ALTER TABLE dbo.Tasks ADD company_id INT NULL;

    IF COL_LENGTH('dbo.Tasks', 'assignee_name') IS NULL
      ALTER TABLE dbo.Tasks ADD assignee_name NVARCHAR(200) NULL;

    IF COL_LENGTH('dbo.Tasks', 'tags') IS NULL
      ALTER TABLE dbo.Tasks ADD tags NVARCHAR(1000) NULL;

    IF OBJECT_ID('dbo.Tickets', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Tickets (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        company_id INT NOT NULL,
        title NVARCHAR(250) NOT NULL,
        description NVARCHAR(MAX) NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'open',
        priority NVARCHAR(50) NOT NULL DEFAULT 'medium',
        assignee_name NVARCHAR(200) NULL,
        reporter_name NVARCHAR(200) NULL,
        comments INT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF COL_LENGTH('dbo.Tickets', 'company_id') IS NULL
      ALTER TABLE dbo.Tickets ADD company_id INT NULL;

    IF COL_LENGTH('dbo.Tickets', 'assignee_name') IS NULL
      ALTER TABLE dbo.Tickets ADD assignee_name NVARCHAR(200) NULL;

    IF COL_LENGTH('dbo.Tickets', 'reporter_name') IS NULL
      ALTER TABLE dbo.Tickets ADD reporter_name NVARCHAR(200) NULL;

    IF COL_LENGTH('dbo.Tickets', 'comments') IS NULL
      ALTER TABLE dbo.Tickets ADD comments INT NOT NULL CONSTRAINT DF_Tickets_comments DEFAULT 0;

    IF OBJECT_ID('dbo.Projects', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Projects (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        company_id INT NOT NULL,
        name NVARCHAR(200) NOT NULL,
        description NVARCHAR(MAX) NULL,
        icon NVARCHAR(50) NOT NULL DEFAULT 'FolderKanban',
        created_by_user_id INT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'active',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF OBJECT_ID('dbo.ProjectMembers', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.ProjectMembers (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        project_id INT NOT NULL,
        company_id INT NOT NULL,
        user_id INT NOT NULL,
        added_by_user_id INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF COL_LENGTH('dbo.Tasks', 'project_id') IS NULL
      ALTER TABLE dbo.Tasks ADD project_id INT NULL;

    IF COL_LENGTH('dbo.Tasks', 'assigned_to_user_id') IS NULL
      ALTER TABLE dbo.Tasks ADD assigned_to_user_id INT NULL;

    IF COL_LENGTH('dbo.Tasks', 'created_by_user_id') IS NULL
      ALTER TABLE dbo.Tasks ADD created_by_user_id INT NULL;

    IF COL_LENGTH('dbo.Tasks', 'assignment_type') IS NULL
      ALTER TABLE dbo.Tasks ADD assignment_type NVARCHAR(50) NOT NULL CONSTRAINT DF_Tasks_assignment_type DEFAULT 'assigned';

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Projects_Company' AND object_id = OBJECT_ID('dbo.Projects'))
      CREATE INDEX IX_Projects_Company ON dbo.Projects(company_id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProjectMembers_Project' AND object_id = OBJECT_ID('dbo.ProjectMembers'))
      CREATE INDEX IX_ProjectMembers_Project ON dbo.ProjectMembers(project_id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProjectMembers_CompanyUser' AND object_id = OBJECT_ID('dbo.ProjectMembers'))
      CREATE INDEX IX_ProjectMembers_CompanyUser ON dbo.ProjectMembers(company_id, user_id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_ProjectMembers_ProjectUser' AND object_id = OBJECT_ID('dbo.ProjectMembers'))
      CREATE UNIQUE INDEX UX_ProjectMembers_ProjectUser ON dbo.ProjectMembers(project_id, user_id);


    IF OBJECT_ID('dbo.AdminLoginOtps', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AdminLoginOtps (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        email NVARCHAR(320) NOT NULL,
        otp_hash NVARCHAR(128) NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'active',
        attempts INT NOT NULL DEFAULT 0,
        expires_at DATETIME2 NOT NULL,
        verified_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF OBJECT_ID('dbo.Teams', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Teams (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        company_id INT NOT NULL,
        name NVARCHAR(200) NOT NULL,
        description NVARCHAR(1000) NULL,
        security_key NVARCHAR(200) NOT NULL,
        created_by_user_id INT NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'active',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF OBJECT_ID('dbo.TeamMembers', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.TeamMembers (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        team_id INT NOT NULL,
        company_id INT NOT NULL,
        user_id INT NOT NULL,
        added_by_user_id INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF OBJECT_ID('dbo.TeamMessages', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.TeamMessages (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        team_id INT NOT NULL,
        company_id INT NOT NULL,
        sender_user_id INT NOT NULL,
        encrypted_body NVARCHAR(MAX) NOT NULL,
        iv NVARCHAR(80) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF OBJECT_ID('dbo.TeamFiles', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.TeamFiles (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        team_id INT NOT NULL,
        company_id INT NOT NULL,
        uploaded_by_user_id INT NOT NULL,
        file_name NVARCHAR(260) NOT NULL,
        mime_type NVARCHAR(200) NULL,
        file_size BIGINT NOT NULL DEFAULT 0,
        encrypted_payload VARBINARY(MAX) NOT NULL,
        iv NVARCHAR(80) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AdminLoginOtps_Email' AND object_id = OBJECT_ID('dbo.AdminLoginOtps'))
      CREATE INDEX IX_AdminLoginOtps_Email ON dbo.AdminLoginOtps(email, status, expires_at);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Teams_Company' AND object_id = OBJECT_ID('dbo.Teams'))
      CREATE INDEX IX_Teams_Company ON dbo.Teams(company_id, status);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_TeamMembers_TeamUser' AND object_id = OBJECT_ID('dbo.TeamMembers'))
      CREATE UNIQUE INDEX UX_TeamMembers_TeamUser ON dbo.TeamMembers(team_id, user_id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TeamMessages_Team' AND object_id = OBJECT_ID('dbo.TeamMessages'))
      CREATE INDEX IX_TeamMessages_Team ON dbo.TeamMessages(team_id, created_at);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TeamFiles_Team' AND object_id = OBJECT_ID('dbo.TeamFiles'))
      CREATE INDEX IX_TeamFiles_Team ON dbo.TeamFiles(team_id, created_at);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_Project' AND object_id = OBJECT_ID('dbo.Tasks'))
      CREATE INDEX IX_Tasks_Project ON dbo.Tasks(project_id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_AssignedTo' AND object_id = OBJECT_ID('dbo.Tasks'))
      CREATE INDEX IX_Tasks_AssignedTo ON dbo.Tasks(assigned_to_user_id);

  `)

  schemaReady = true
}
