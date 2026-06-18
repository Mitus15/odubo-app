-- =============================================================================
-- Migration 137: The Ark - Integrations (Platform/Service Connections)
-- =============================================================================

-- ARK_INTEGRATIONS: Reusable platform/service definitions
CREATE TABLE IF NOT EXISTS ark_integrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform_type TEXT,
  icon TEXT,
  color TEXT,
  base_url TEXT,
  description TEXT,
  default_metadata_schema TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ark_integrations_type ON ark_integrations(platform_type);

-- ARK_PROJECT_INTEGRATIONS: Which platforms a project uses
CREATE TABLE IF NOT EXISTS ark_project_integrations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  access_url TEXT,
  config TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES ark_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (integration_id) REFERENCES ark_integrations(id) ON DELETE CASCADE,
  UNIQUE(project_id, integration_id)
);

CREATE INDEX IF NOT EXISTS idx_ark_proj_int_project ON ark_project_integrations(project_id);
CREATE INDEX IF NOT EXISTS idx_ark_proj_int_integration ON ark_project_integrations(integration_id);

-- Add FK reference for ark_assets.integration_id (was created without FK in migration 136)
-- SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so the FK is logical only.
-- The application layer enforces the relationship.
