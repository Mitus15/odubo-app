-- The Hub RBAC System
-- Migration: 050_hub_rbac_system.sql
-- Created: 2025-12-18

-- Role definitions (system-defined roles)
CREATE TABLE IF NOT EXISTS role_definitions (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  default_modules TEXT NOT NULL DEFAULT '[]', -- JSON array of module slugs
  default_permissions TEXT NOT NULL DEFAULT '{}', -- JSON object of permissions per module
  is_system INTEGER DEFAULT 0, -- System roles cannot be deleted
  color TEXT DEFAULT '#843c2d', -- Role badge color
  icon TEXT, -- Icon identifier
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- User role assignments (many-to-many: users can have multiple roles)
CREATE TABLE IF NOT EXISTS user_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role_slug TEXT NOT NULL,
  module_overrides TEXT, -- JSON object to override default module access
  permission_overrides TEXT, -- JSON object to override default permissions
  assigned_by TEXT,
  assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT, -- Optional role expiration
  is_active INTEGER DEFAULT 1,
  notes TEXT, -- Admin notes about the assignment
  UNIQUE(user_id, role_slug),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_slug) REFERENCES role_definitions(slug) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_slug);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active);

-- Permission audit log (track permission changes)
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'role_assigned', 'role_removed', 'permission_changed'
  target_user_id TEXT,
  role_slug TEXT,
  details TEXT, -- JSON with change details
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_permission_audit_user ON permission_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_target ON permission_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_created ON permission_audit_log(created_at DESC);

-- Insert default role definitions
-- Module slugs: content, social, commerce, analytics, communications, projects, events, system, reports
-- Permission types: read, write, delete, admin, approve, export

INSERT OR IGNORE INTO role_definitions (slug, name, description, default_modules, default_permissions, is_system, color, icon) VALUES
(
  'admin',
  'Administrator',
  'Full access to all modules and settings',
  '["*"]',
  '{"*": ["admin"]}',
  1,
  '#843c2d',
  'shield'
),
(
  'social_manager',
  'Social Media Manager',
  'Manages social distribution and content scheduling',
  '["social", "content", "analytics", "communications"]',
  '{"social": ["read", "write", "delete", "approve"], "content": ["read"], "analytics": ["read"], "communications": ["read"]}',
  0,
  '#3b82f6',
  'megaphone'
),
(
  'content_editor',
  'Content Editor',
  'Creates and edits media content',
  '["content", "moments", "social"]',
  '{"content": ["read", "write", "delete"], "moments": ["read", "write", "delete"], "social": ["read"]}',
  0,
  '#22c55e',
  'pencil'
),
(
  'merchandiser',
  'Merchandiser',
  'Manages products and inventory',
  '["commerce", "analytics", "reports"]',
  '{"commerce": ["read", "write"], "analytics": ["read"], "reports": ["read", "export"]}',
  0,
  '#f59e0b',
  'tag'
),
(
  'customer_service',
  'Customer Service',
  'Handles customer inquiries and support',
  '["communications", "commerce"]',
  '{"communications": ["read", "write"], "commerce": ["read"]}',
  0,
  '#ec4899',
  'headset'
),
(
  'developer',
  'Developer',
  'Technical maintenance and system monitoring',
  '["system", "content", "analytics", "reports"]',
  '{"system": ["read", "write", "admin"], "content": ["read"], "analytics": ["read"], "reports": ["read", "export"]}',
  0,
  '#8b5cf6',
  'code'
),
(
  'scm_manager',
  'SCM Manager',
  'Supply chain and vendor management',
  '["commerce", "events", "projects"]',
  '{"commerce": ["read", "write"], "events": ["read", "write"], "projects": ["read", "write"]}',
  0,
  '#06b6d4',
  'truck'
),
(
  'accountant',
  'Accountant',
  'Financial reports and commerce oversight',
  '["commerce", "analytics", "reports"]',
  '{"commerce": ["read"], "analytics": ["read"], "reports": ["read", "export"]}',
  0,
  '#14b8a6',
  'calculator'
),
(
  'hr_manager',
  'HR Manager',
  'Team management and internal communications',
  '["system", "communications", "projects"]',
  '{"system": ["read"], "communications": ["read", "write", "admin"], "projects": ["read", "write", "admin"]}',
  0,
  '#f97316',
  'users'
),
(
  'marketing_manager',
  'Marketing Manager',
  'Campaigns, social, and analytics',
  '["marketing", "social", "analytics", "content", "events", "reports"]',
  '{"marketing": ["read", "write", "delete", "admin"], "social": ["read", "write", "approve"], "analytics": ["read", "export"], "content": ["read"], "events": ["read", "write"], "reports": ["read", "export"]}',
  0,
  '#ef4444',
  'chart'
),
(
  'project_manager',
  'Project Manager',
  'Project coordination and cross-team oversight',
  '["projects", "communications", "events", "content", "analytics", "reports"]',
  '{"projects": ["read", "write", "delete", "admin"], "communications": ["read", "write"], "events": ["read", "write"], "content": ["read"], "analytics": ["read"], "reports": ["read", "export"]}',
  0,
  '#6366f1',
  'clipboard'
);

-- Assign admin role to existing admins (migration)
INSERT OR IGNORE INTO user_roles (user_id, role_slug, assigned_by, notes)
SELECT id, 'admin', id, 'Migrated from is_admin flag'
FROM users
WHERE is_admin = 1;
