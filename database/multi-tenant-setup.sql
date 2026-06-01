/*
  Volt Multi-Dashboard / Multi-Company Setup
  Run this once in SSMS against your Volt Azure SQL database.

  Concept:
  - Companies = dashboards / workspaces. Example: PK Capital, Altruco, Kaedyn Developments.
  - AppUsers = a user's membership inside a dashboard. Same email can belong to multiple dashboards.
  - AccessCodes = admin/business owner/employee join codes for a dashboard.
  - Tasks and Tickets are filtered by company_id, so dashboards do not mix data.
*/

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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AppUsers_Email' AND object_id = OBJECT_ID('dbo.AppUsers'))
  CREATE INDEX IX_AppUsers_Email ON dbo.AppUsers(email);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AppUsers_Company' AND object_id = OBJECT_ID('dbo.AppUsers'))
  CREATE INDEX IX_AppUsers_Company ON dbo.AppUsers(company_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_Company' AND object_id = OBJECT_ID('dbo.Tasks'))
  CREATE INDEX IX_Tasks_Company ON dbo.Tasks(company_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tickets_Company' AND object_id = OBJECT_ID('dbo.Tickets'))
  CREATE INDEX IX_Tickets_Company ON dbo.Tickets(company_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AccessCodes_Company' AND object_id = OBJECT_ID('dbo.AccessCodes'))
  CREATE INDEX IX_AccessCodes_Company ON dbo.AccessCodes(company_id);
