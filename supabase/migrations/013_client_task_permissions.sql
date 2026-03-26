-- ─────────────────────────────────────────────────────────────────────────────
-- 013_client_task_permissions.sql
--
-- Allows clients to UPDATE specific task fields (status, priority, due_date,
-- start_date, description) on tasks within workspaces they are a member of.
-- Clients still cannot INSERT or DELETE tasks, and cannot change the title
-- or assignee (those remain admin-only on the frontend).
-- ─────────────────────────────────────────────────────────────────────────────

-- is_workspace_member(uuid) already exists from an earlier migration — no changes needed.

-- Drop any existing conflicting update policy before creating the new one
DROP POLICY IF EXISTS "Clients can update their workspace tasks" ON tasks;
DROP POLICY IF EXISTS "Workspace members can update tasks" ON tasks;

-- Grant clients UPDATE access on tasks for workspaces they belong to
CREATE POLICY "Workspace members can update tasks"
  ON tasks
  FOR UPDATE
  USING (is_workspace_member(workspace_id))
  WITH CHECK (is_workspace_member(workspace_id));
