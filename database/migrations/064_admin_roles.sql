-- ============================================================================
-- Migration 064: Admin Role-Based Permission System
-- ============================================================================
-- Creates a simple, section-based permission system where:
--   - Users can be assigned multiple roles
--   - Each role grants access to specific admin sections
--   - Permissions combine when users have multiple roles
-- ============================================================================

-- Admin roles table
CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,           -- 'admin', 'social_manager', etc.
  display_name TEXT NOT NULL,          -- 'Admin', 'Social Manager'
  description TEXT,
  sections TEXT NOT NULL,              -- JSON array: ["cms", "social", ...]
  color TEXT DEFAULT '#843c2d',        -- UI accent color
  is_system INTEGER DEFAULT 0,         -- Can't be deleted if 1
  created_at TEXT DEFAULT (datetime('now'))
);

-- User-role assignments (many-to-many)
CREATE TABLE IF NOT EXISTS admin_user_roles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  assigned_by TEXT,
  assigned_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, role_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_user_roles_user ON admin_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_roles_role ON admin_user_roles(role_id);

-- ============================================================================
-- Seed predefined roles
-- ============================================================================

-- Admin: Full access to all sections
INSERT OR IGNORE INTO admin_roles (id, name, display_name, description, sections, color, is_system)
VALUES (
  'role_admin',
  'admin',
  'Admin',
  'Full access to all admin sections',
  '["*"]',
  '#843c2d',
  1
);

-- Social Manager: Social media operations
INSERT OR IGNORE INTO admin_roles (id, name, display_name, description, sections, color, is_system)
VALUES (
  'role_social',
  'social_manager',
  'Social Manager',
  'Manage social media posting and accounts',
  '["overview", "social", "marketing", "analytics"]',
  '#E4405F',
  1
);

-- Content Editor: CMS operations
INSERT OR IGNORE INTO admin_roles (id, name, display_name, description, sections, color, is_system)
VALUES (
  'role_content',
  'content_editor',
  'Content Editor',
  'Manage music, videos, moments, and other content',
  '["overview", "cms", "analytics"]',
  '#3b82f6',
  1
);

-- Store Manager: Commerce operations
INSERT OR IGNORE INTO admin_roles (id, name, display_name, description, sections, color, is_system)
VALUES (
  'role_store',
  'store_manager',
  'Store Manager',
  'Manage products, orders, and customers',
  '["overview", "commerce", "analytics"]',
  '#22c55e',
  1
);

-- ============================================================================
-- Migrate existing admins
-- ============================================================================
-- Users with is_admin=1 get the admin role automatically

INSERT OR IGNORE INTO admin_user_roles (id, user_id, role_id, assigned_by, assigned_at)
SELECT
  lower(hex(randomblob(8))),
  id,
  'role_admin',
  'system',
  datetime('now')
FROM users
WHERE is_admin = 1;
