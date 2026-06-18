-- =============================================================================
-- Migration 140: The Ark - Add scheduled_date to tasks
-- scheduled_date = when you PLAN to work on it (calendar slot)
-- due_date = the deadline (when it's DUE)
-- These are independent: a task due Friday can be scheduled for Wednesday
-- =============================================================================

ALTER TABLE ark_tasks ADD COLUMN scheduled_date TEXT;

CREATE INDEX IF NOT EXISTS idx_ark_tasks_scheduled ON ark_tasks(scheduled_date);
