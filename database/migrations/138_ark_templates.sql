-- =============================================================================
-- Migration 138: The Ark - Templates
-- =============================================================================

-- ARK_TEMPLATES: Reusable project structures
CREATE TABLE IF NOT EXISTS ark_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT,
  description TEXT,
  icon TEXT,
  color TEXT,
  charter_template TEXT,
  default_objectives TEXT,
  default_milestones TEXT,
  default_tasks TEXT,
  default_integrations TEXT,
  default_tags TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES ark_categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ark_templates_category ON ark_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_ark_templates_active ON ark_templates(is_active);
