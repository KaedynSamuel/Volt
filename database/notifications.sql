-- Volt Notifications SQL Migration
-- Run this once against your SQL Server database before deploying the updated app.
-- This file adds the in-app notifications table and sets up email triggers for tasks and tickets.

IF OBJECT_ID('dbo.VoltNotifications', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.VoltNotifications (
    id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    company_id    INT NOT NULL,
    user_id       INT NOT NULL,
    type          NVARCHAR(50) NOT NULL,
    -- type values: 'task_created', 'task_assigned', 'ticket_created', 'ticket_assigned', 'ticket_closed', 'ticket_resolved'
    title         NVARCHAR(255) NOT NULL,
    message       NVARCHAR(1000) NOT NULL,
    related_id    NVARCHAR(100) NULL,
    -- related_id: the task id or ticket id this notification is about
    is_read       BIT NOT NULL DEFAULT 0,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_VoltNotifications_UserId ON dbo.VoltNotifications (user_id, company_id, is_read);
  CREATE INDEX IX_VoltNotifications_CompanyId ON dbo.VoltNotifications (company_id, created_at DESC);
END;

-- Add email column to Users if not present (used for routing notifications)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Users' AND COLUMN_NAME = 'email'
)
BEGIN
  ALTER TABLE dbo.Users ADD email NVARCHAR(320) NULL;
END;

-- Also ensure the DashboardUsers table has email (already defined in access-control.sql but safe to run)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'DashboardUsers' AND COLUMN_NAME = 'email'
)
BEGIN
  ALTER TABLE dbo.DashboardUsers ADD email NVARCHAR(320) NULL;
END;

-- Add due_date column to Projects if not present
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Projects' AND COLUMN_NAME = 'due_date'
)
BEGIN
  ALTER TABLE dbo.Projects ADD due_date DATE NULL;
END;
