-- ─────────────────────────────────────────────────────────────────────────────
-- 013_client_task_permissions.sql
--
-- Allows clients to UPDATE specific task fields (status, priority, due_date,
-- start_date, description) on tasks within workspaces they are a member of.
-- Clients still cannot INSERT or DELETE tasks, and cannot change the title
-- or assignee (those remain admin-only on the frontend).
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: drop and recreate to avoid parameter name conflict with any prior version
DROP FUNCTION IF EXISTS is_workspace_member(uuid);

CREATE FUNCTION is_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
  );
$$;

-- Drop any existing client update policy to avoid conflicts
DROP POLICY IF EXISTS "Clients can update their workspace tasks" ON tasks;

-- Grant clients UPDATE access on tasks for workspaces they belong to
CREATE POLICY "Workspace members can update tasks"
  ON tasks
  FOR UPDATE
  USING (is_workspace_member(workspace_id))
  WITH CHECK (is_workspace_member(workspace_id));
