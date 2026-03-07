-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007 — Add 'designer' to role check constraints
-- ─────────────────────────────────────────────────────────────────────────────

-- profiles table
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'client', 'designer'));

-- workspace_members table
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('admin', 'client', 'designer'));
