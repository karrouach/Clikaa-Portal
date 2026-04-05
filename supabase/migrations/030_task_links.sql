-- 030_task_links.sql
-- Add a links array to tasks for storing Figma, Notion, GitHub URLs, etc.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS links text[] DEFAULT '{}'::text[];
