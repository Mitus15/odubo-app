-- =============================================================================
-- Migration 134: The Ark - Core (Categories, Statuses, Projects)
-- =============================================================================

-- ARK_CATEGORIES: User-created project groups (fully dynamic)
CREATE TABLE IF NOT EXISTS ark_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ARK_STATUSES: User-defined workflow states
CREATE TABLE IF NOT EXISTS ark_statuses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  is_closed INTEGER DEFAULT 0,
  is_default INTEGER DEFAULT 0,
  applies_to TEXT DEFAULT 'all',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ARK_PROJECTS: The central entity
CREATE TABLE IF NOT EXISTS ark_projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category_id TEXT,
  status_id TEXT,
  priority TEXT DEFAULT 'medium',
  charter TEXT,
  objectives TEXT,
  success_criteria TEXT,
  start_date TEXT,
  target_date TEXT,
  completed_date TEXT,
  color TEXT,
  icon TEXT,
  cover_image_url TEXT,
  tags TEXT,
  metadata TEXT,
  parent_project_id TEXT,
  template_id TEXT,
  progress_percent INTEGER DEFAULT 0,
  archived_at TEXT,
  archive_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES ark_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (status_id) REFERENCES ark_statuses(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_project_id) REFERENCES ark_projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ark_projects_category ON ark_projects(category_id);
CREATE INDEX IF NOT EXISTS idx_ark_projects_status ON ark_projects(status_id);
CREATE INDEX IF NOT EXISTS idx_ark_projects_priority ON ark_projects(priority);
CREATE INDEX IF NOT EXISTS idx_ark_projects_parent ON ark_projects(parent_project_id);
CREATE INDEX IF NOT EXISTS idx_ark_projects_archived ON ark_projects(archived_at);

-- Seed default statuses
INSERT OR IGNORE INTO ark_statuses (id, name, color, sort_order, is_closed, is_default, applies_to) VALUES
  ('status_idea', 'Idea', '#a855f7', 0, 0, 0, 'all'),
  ('status_planning', 'Planning', '#3b82f6', 1, 0, 0, 'all'),
  ('status_active', 'Active', '#22c55e', 2, 0, 1, 'all'),
  ('status_paused', 'Paused', '#f59e0b', 3, 0, 0, 'all'),
  ('status_blocked', 'Blocked', '#ef4444', 4, 0, 0, 'all'),
  ('status_review', 'Review', '#06b6d4', 5, 0, 0, 'all'),
  ('status_done', 'Done', '#10b981', 6, 1, 0, 'all'),
  ('status_archived', 'Archived', '#6b7280', 7, 1, 0, 'all');

-- Seed default task statuses
INSERT OR IGNORE INTO ark_statuses (id, name, color, sort_order, is_closed, is_default, applies_to) VALUES
  ('task_todo', 'To Do', '#94a3b8', 10, 0, 1, 'task'),
  ('task_in_progress', 'In Progress', '#3b82f6', 11, 0, 0, 'task'),
  ('task_blocked', 'Blocked', '#ef4444', 12, 0, 0, 'task'),
  ('task_done', 'Done', '#10b981', 13, 1, 0, 'task'),
  ('task_cancelled', 'Cancelled', '#6b7280', 14, 1, 0, 'task');
