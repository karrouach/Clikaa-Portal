-- ─────────────────────────────────────────────────────────────────────────────
-- 027_workspace_member_roles.sql
-- Expands the workspace_members.role check constraint to match the full set
-- of internal roles added in 026_expanded_roles.sql for profiles.
--
-- The frontend resolves the UI value 'internal_team' to the user's actual
-- profile role (designer / developer / marketer / project_manager) before
-- inserting, so 'internal_team' is NOT a stored DB value.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_role_check;

ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('admin', 'client', 'designer', 'developer', 'marketer', 'project_manager'));
