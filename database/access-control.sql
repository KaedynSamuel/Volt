-- Optional SQL backing for the new role/access-code flow.
-- The current UI stores access codes in browser storage so it can run immediately.
-- Use these tables when you are ready to make access codes shared across all users/devices.

CREATE TABLE dbo.DashboardUsers (
  id INT IDENTITY(1,1) PRIMARY KEY,
  full_name NVARCHAR(150) NOT NULL,
  email NVARCHAR(255) NULL,
  user_role NVARCHAR(30) NOT NULL CHECK (user_role IN ('employee', 'business-owner', 'admin')),
  access_code NVARCHAR(80) NOT NULL UNIQUE,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.CustomDashboards (
  id INT IDENTITY(1,1) PRIMARY KEY,
  dashboard_name NVARCHAR(150) NOT NULL,
  owner_name NVARCHAR(150) NOT NULL,
  theme_color NVARCHAR(20) NOT NULL DEFAULT '#8b5cf6',
  created_by_user_id INT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_CustomDashboards_DashboardUsers
    FOREIGN KEY (created_by_user_id) REFERENCES dbo.DashboardUsers(id)
);

CREATE TABLE dbo.DashboardMemberships (
  id INT IDENTITY(1,1) PRIMARY KEY,
  dashboard_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_DashboardMemberships_CustomDashboards
    FOREIGN KEY (dashboard_id) REFERENCES dbo.CustomDashboards(id),
  CONSTRAINT FK_DashboardMemberships_DashboardUsers
    FOREIGN KEY (user_id) REFERENCES dbo.DashboardUsers(id),
  CONSTRAINT UQ_DashboardMembership UNIQUE (dashboard_id, user_id)
);

-- Optional task columns for personal vs company dashboards.
-- Only run these if they do not exist yet.
ALTER TABLE dbo.Tasks ADD dashboard_id INT NULL;
ALTER TABLE dbo.Tasks ADD assigned_user_id INT NULL;
ALTER TABLE dbo.Tasks ADD is_personal BIT NOT NULL DEFAULT 0;
