/*
  Volt Projects + Project Task Assignment
  Run this once in SSMS against your Volt database.

  What this adds:
  - Projects belong to one dashboard/company only.
  - Project members are users from that same dashboard only.
  - Tasks can be personal, assigned to a dashboard user, and optionally linked to a project.
  - If a task is linked to a project, assigned_to_user_id should be a member of that project.
*/

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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_Project' AND object_id = OBJECT_ID('dbo.Tasks'))
  CREATE INDEX IX_Tasks_Project ON dbo.Tasks(project_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_AssignedTo' AND object_id = OBJECT_ID('dbo.Tasks'))
  CREATE INDEX IX_Tasks_AssignedTo ON dbo.Tasks(assigned_to_user_id);
