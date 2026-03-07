-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006 — Add 'pending' to tasks status
-- ─────────────────────────────────────────────────────────────────────────────
-- Drops the existing CHECK constraint and recreates it with the new 'pending'
-- value included. Safe to run against an existing tasks table.

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'pending'));
