-- ─────────────────────────────────────────────────────────────────────────────
-- 026_expanded_roles.sql
-- Expands the profiles.role check constraint to support the full agency model:
-- Designer, Developer, Marketer, Project Manager in addition to Admin & Client.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop existing check constraint (Supabase default naming convention)
alter table public.profiles
  drop constraint if exists profiles_role_check;

-- Add expanded constraint
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'client', 'designer', 'developer', 'marketer', 'project_manager'));
