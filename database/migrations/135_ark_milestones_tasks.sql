-- =============================================================================
-- Migration 135: The Ark - Milestones & Tasks
-- =============================================================================

-- ARK_MILESTONES: Major phases/checkpoints within a project
CREATE TABLE IF NOT EXISTS ark_milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status_id TEXT,
  sort_order INTEGER DEFAULT 0,
  target_date TEXT,
  completed_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES ark_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (status_id) REFERENCES ark_statuses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ark_milestones_project ON ark_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_ark_milestones_status ON ark_milestones(status_id);

-- ARK_TASKS: Individual work items
CREATE TABLE IF NOT EXISTS ark_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  milestone_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status_id TEXT,
  priority TEXT DEFAULT 'medium',
  sort_order INTEGER DEFAULT 0,
  due_date TEXT,
  completed_date TEXT,
  estimated_hours REAL,
  actual_hours REAL,
  depends_on TEXT,
  assigned_to TEXT,
  tags TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES ark_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (milestone_id) REFERENCES ark_milestones(id) ON DELETE SET NULL,
  FOREIGN KEY (status_id) REFERENCES ark_statuses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ark_tasks_project ON ark_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_ark_tasks_milestone ON ark_tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_ark_tasks_status ON ark_tasks(status_id);
CREATE INDEX IF NOT EXISTS idx_ark_tasks_due ON ark_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_ark_tasks_priority ON ark_tasks(priority);
