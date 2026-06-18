-- =============================================================================
-- Migration 139: The Ark - Custom Fields
-- =============================================================================

-- ARK_CUSTOM_FIELDS: User-defined fields per category
CREATE TABLE IF NOT EXISTS ark_custom_fields (
  id TEXT PRIMARY KEY,
  category_id TEXT,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  options TEXT,
  sort_order INTEGER DEFAULT 0,
  is_required INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES ark_categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ark_custom_fields_category ON ark_custom_fields(category_id);

-- ARK_CUSTOM_FIELD_VALUES: Values for custom fields
CREATE TABLE IF NOT EXISTS ark_custom_field_values (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  value TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES ark_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (field_id) REFERENCES ark_custom_fields(id) ON DELETE CASCADE,
  UNIQUE(project_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_ark_cfv_project ON ark_custom_field_values(project_id);
CREATE INDEX IF NOT EXISTS idx_ark_cfv_field ON ark_custom_field_values(field_id);
