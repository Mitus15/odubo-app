// The Ark - Project Management Types

// ============================================
// CATEGORY
// ============================================

export type ArkCategory = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export type ArkCategoryInput = {
  name: string;
  color?: string;
  icon?: string;
  description?: string;
  sort_order?: number;
};

// ============================================
// STATUS
// ============================================

export type ArkStatus = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_closed: number;
  is_default: number;
  applies_to: string;
  created_at: string;
};

export type ArkStatusInput = {
  name: string;
  color?: string;
  sort_order?: number;
  is_closed?: boolean;
  is_default?: boolean;
  applies_to?: 'all' | 'project' | 'task';
};

// ============================================
// PROJECT
// ============================================

export type ArkProject = {
  id: string;
  title: string;
  category_id: string | null;
  status_id: string | null;
  priority: string;
  charter: string | null;
  objectives: string | null;
  success_criteria: string | null;
  start_date: string | null;
  target_date: string | null;
  completed_date: string | null;
  color: string | null;
  icon: string | null;
  cover_image_url: string | null;
  tags: string | null;
  metadata: string | null;
  parent_project_id: string | null;
  template_id: string | null;
  progress_percent: number;
  archived_at: string | null;
  archive_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields (optional)
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  status_name?: string;
  status_color?: string;
  task_count?: number;
  task_done_count?: number;
};

export type ArkProjectInput = {
  title: string;
  category_id?: string;
  status_id?: string;
  priority?: string;
  charter?: string;
  objectives?: string[];
  success_criteria?: string[];
  start_date?: string;
  target_date?: string;
  color?: string;
  icon?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  parent_project_id?: string;
  template_id?: string;
};

// ============================================
// MILESTONE
// ============================================

export type ArkMilestone = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status_id: string | null;
  sort_order: number;
  target_date: string | null;
  completed_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  status_name?: string;
  status_color?: string;
  task_count?: number;
  task_done_count?: number;
};

export type ArkMilestoneInput = {
  title: string;
  description?: string;
  status_id?: string;
  sort_order?: number;
  target_date?: string;
};

// ============================================
// TASK
// ============================================

export type ArkTask = {
  id: string;
  project_id: string;
  milestone_id: string | null;
  title: string;
  description: string | null;
  status_id: string | null;
  priority: string;
  sort_order: number;
  due_date: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  depends_on: string | null;
  assigned_to: string | null;
  tags: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  status_name?: string;
  status_color?: string;
  milestone_title?: string;
};

export type ArkTaskInput = {
  title: string;
  description?: string;
  milestone_id?: string;
  status_id?: string;
  priority?: string;
  sort_order?: number;
  due_date?: string;
  scheduled_date?: string;
  estimated_hours?: number;
  depends_on?: string[];
  assigned_to?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

// ============================================
// NOTE
// ============================================

export type ArkNote = {
  id: string;
  project_id: string;
  title: string | null;
  content: string;
  category: string | null;
  is_pinned: number;
  tags: string | null;
  created_at: string;
  updated_at: string;
};

export type ArkNoteInput = {
  title?: string;
  content: string;
  category?: string;
  is_pinned?: boolean;
  tags?: string[];
};

// ============================================
// ASSET
// ============================================

export type ArkAsset = {
  id: string;
  project_id: string;
  title: string;
  asset_type: string | null;
  url: string | null;
  r2_key: string | null;
  description: string | null;
  category: string | null;
  integration_id: string | null;
  metadata: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined
  integration_name?: string;
  integration_icon?: string;
  integration_color?: string;
};

export type ArkAssetInput = {
  title: string;
  asset_type?: string;
  url?: string;
  r2_key?: string;
  description?: string;
  category?: string;
  integration_id?: string;
  metadata?: Record<string, unknown>;
  sort_order?: number;
};

// ============================================
// INTEGRATION
// ============================================

export type ArkIntegration = {
  id: string;
  name: string;
  platform_type: string | null;
  icon: string | null;
  color: string | null;
  base_url: string | null;
  description: string | null;
  default_metadata_schema: string | null;
  created_at: string;
  updated_at: string;
};

export type ArkIntegrationInput = {
  name: string;
  platform_type?: string;
  icon?: string;
  color?: string;
  base_url?: string;
  description?: string;
  default_metadata_schema?: Record<string, unknown>;
};

// ============================================
// PROJECT INTEGRATION (junction)
// ============================================

export type ArkProjectIntegration = {
  id: string;
  project_id: string;
  integration_id: string;
  access_url: string | null;
  config: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  // Joined
  integration_name?: string;
  integration_icon?: string;
  integration_color?: string;
  integration_platform_type?: string;
};

export type ArkProjectIntegrationInput = {
  integration_id: string;
  access_url?: string;
  config?: Record<string, unknown>;
  notes?: string;
};

// ============================================
// TIMELINE
// ============================================

export type ArkTimelineEntry = {
  id: string;
  project_id: string;
  entry_type: string;
  title: string;
  description: string | null;
  metadata: string | null;
  created_at: string;
};

export type ArkTimelineEntryInput = {
  entry_type: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

// ============================================
// TEMPLATE
// ============================================

export type ArkTemplate = {
  id: string;
  name: string;
  category_id: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  charter_template: string | null;
  default_objectives: string | null;
  default_milestones: string | null;
  default_tasks: string | null;
  default_integrations: string | null;
  default_tags: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  // Joined
  category_name?: string;
};

export type ArkTemplateInput = {
  name: string;
  category_id?: string;
  description?: string;
  icon?: string;
  color?: string;
  charter_template?: string;
  default_objectives?: string[];
  default_milestones?: Array<{ title: string; description?: string; tasks?: Array<{ title: string; priority?: string }> }>;
  default_tasks?: Array<{ title: string; description?: string; priority?: string }>;
  default_integrations?: string[];
  default_tags?: string[];
};

// ============================================
// CUSTOM FIELD
// ============================================

export type ArkCustomField = {
  id: string;
  category_id: string | null;
  name: string;
  field_type: string;
  options: string | null;
  sort_order: number;
  is_required: number;
  created_at: string;
};

export type ArkCustomFieldInput = {
  category_id?: string;
  name: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'url';
  options?: string[];
  sort_order?: number;
  is_required?: boolean;
};

export type ArkCustomFieldValue = {
  id: string;
  project_id: string;
  field_id: string;
  value: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  field_name?: string;
  field_type?: string;
};
