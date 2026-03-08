-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009 — Add start_date to tasks
-- Enables scheduling tasks with a start and end (due) date span.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS start_date date;

COMMENT ON COLUMN public.tasks.start_date IS
  'Optional start date for the task span. Used alongside due_date for calendar range display.';
