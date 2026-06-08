/*
  Volt migration: remove access-code flow, add admin OTP onboarding,
  admin-created users, Teams, encrypted team chat and encrypted file share.

  Run this once against your SQL Server database before deploying the updated app.
  This version is safe to re-run. It also fixes partially-created tables by adding
  missing columns before indexes are created.
*/

/* Optional hard removal of old access-code data. Keep commented if you want history first. */
-- IF OBJECT_ID('dbo.AccessCodes', 'U') IS NOT NULL DROP TABLE dbo.AccessCodes;

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

/* Repair columns if the tables already existed before this migration. */
IF COL_LENGTH('dbo.AdminLoginOtps', 'otp_hash') IS NULL
  ALTER TABLE dbo.AdminLoginOtps ADD otp_hash NVARCHAR(128) NULL;
IF COL_LENGTH('dbo.AdminLoginOtps', 'status') IS NULL
  ALTER TABLE dbo.AdminLoginOtps ADD status NVARCHAR(50) NOT NULL CONSTRAINT DF_AdminLoginOtps_Status DEFAULT 'active';
IF COL_LENGTH('dbo.AdminLoginOtps', 'attempts') IS NULL
  ALTER TABLE dbo.AdminLoginOtps ADD attempts INT NOT NULL CONSTRAINT DF_AdminLoginOtps_Attempts DEFAULT 0;
IF COL_LENGTH('dbo.AdminLoginOtps', 'expires_at') IS NULL
  ALTER TABLE dbo.AdminLoginOtps ADD expires_at DATETIME2 NULL;
IF COL_LENGTH('dbo.AdminLoginOtps', 'verified_at') IS NULL
  ALTER TABLE dbo.AdminLoginOtps ADD verified_at DATETIME2 NULL;
IF COL_LENGTH('dbo.AdminLoginOtps', 'created_at') IS NULL
  ALTER TABLE dbo.AdminLoginOtps ADD created_at DATETIME2 NOT NULL CONSTRAINT DF_AdminLoginOtps_CreatedAt DEFAULT SYSUTCDATETIME();

IF COL_LENGTH('dbo.Teams', 'description') IS NULL
  ALTER TABLE dbo.Teams ADD description NVARCHAR(1000) NULL;
IF COL_LENGTH('dbo.Teams', 'security_key') IS NULL
  ALTER TABLE dbo.Teams ADD security_key NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Teams', 'created_by_user_id') IS NULL
  ALTER TABLE dbo.Teams ADD created_by_user_id INT NULL;
IF COL_LENGTH('dbo.Teams', 'status') IS NULL
  ALTER TABLE dbo.Teams ADD status NVARCHAR(50) NOT NULL CONSTRAINT DF_Teams_Status DEFAULT 'active';
IF COL_LENGTH('dbo.Teams', 'created_at') IS NULL
  ALTER TABLE dbo.Teams ADD created_at DATETIME2 NOT NULL CONSTRAINT DF_Teams_CreatedAt DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.Teams', 'updated_at') IS NULL
  ALTER TABLE dbo.Teams ADD updated_at DATETIME2 NOT NULL CONSTRAINT DF_Teams_UpdatedAt DEFAULT SYSUTCDATETIME();

IF COL_LENGTH('dbo.TeamMembers', 'company_id') IS NULL
  ALTER TABLE dbo.TeamMembers ADD company_id INT NULL;
IF COL_LENGTH('dbo.TeamMembers', 'added_by_user_id') IS NULL
  ALTER TABLE dbo.TeamMembers ADD added_by_user_id INT NULL;
IF COL_LENGTH('dbo.TeamMembers', 'created_at') IS NULL
  ALTER TABLE dbo.TeamMembers ADD created_at DATETIME2 NOT NULL CONSTRAINT DF_TeamMembers_CreatedAt DEFAULT SYSUTCDATETIME();

IF COL_LENGTH('dbo.TeamMessages', 'company_id') IS NULL
  ALTER TABLE dbo.TeamMessages ADD company_id INT NULL;
IF COL_LENGTH('dbo.TeamMessages', 'encrypted_body') IS NULL
  ALTER TABLE dbo.TeamMessages ADD encrypted_body NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.TeamMessages', 'iv') IS NULL
  ALTER TABLE dbo.TeamMessages ADD iv NVARCHAR(80) NULL;
IF COL_LENGTH('dbo.TeamMessages', 'created_at') IS NULL
  ALTER TABLE dbo.TeamMessages ADD created_at DATETIME2 NOT NULL CONSTRAINT DF_TeamMessages_CreatedAt DEFAULT SYSUTCDATETIME();

IF COL_LENGTH('dbo.TeamFiles', 'company_id') IS NULL
  ALTER TABLE dbo.TeamFiles ADD company_id INT NULL;
IF COL_LENGTH('dbo.TeamFiles', 'uploaded_by_user_id') IS NULL
  ALTER TABLE dbo.TeamFiles ADD uploaded_by_user_id INT NULL;
IF COL_LENGTH('dbo.TeamFiles', 'file_name') IS NULL
  ALTER TABLE dbo.TeamFiles ADD file_name NVARCHAR(260) NULL;
IF COL_LENGTH('dbo.TeamFiles', 'mime_type') IS NULL
  ALTER TABLE dbo.TeamFiles ADD mime_type NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.TeamFiles', 'file_size') IS NULL
  ALTER TABLE dbo.TeamFiles ADD file_size BIGINT NOT NULL CONSTRAINT DF_TeamFiles_FileSize DEFAULT 0;
IF COL_LENGTH('dbo.TeamFiles', 'encrypted_payload') IS NULL
  ALTER TABLE dbo.TeamFiles ADD encrypted_payload VARBINARY(MAX) NULL;
IF COL_LENGTH('dbo.TeamFiles', 'iv') IS NULL
  ALTER TABLE dbo.TeamFiles ADD iv NVARCHAR(80) NULL;
IF COL_LENGTH('dbo.TeamFiles', 'created_at') IS NULL
  ALTER TABLE dbo.TeamFiles ADD created_at DATETIME2 NOT NULL CONSTRAINT DF_TeamFiles_CreatedAt DEFAULT SYSUTCDATETIME();

/* Backfill safe values for partially-created existing rows. */
UPDATE dbo.AdminLoginOtps SET status = 'active' WHERE status IS NULL;
UPDATE dbo.AdminLoginOtps SET attempts = 0 WHERE attempts IS NULL;
UPDATE dbo.Teams SET status = 'active' WHERE status IS NULL;
UPDATE dbo.Teams SET security_key = CONCAT('legacy-team-', id) WHERE security_key IS NULL;
UPDATE dbo.Teams SET created_by_user_id = 0 WHERE created_by_user_id IS NULL;

/* Indexes: only create after the columns above are guaranteed to exist. */
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
