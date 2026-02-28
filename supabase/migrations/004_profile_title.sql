-- ============================================================
-- Clikaa Client Portal — Phase 7: Profile Title
-- Adds an optional `title` column to the profiles table so
-- team members can display their role/specialty (e.g. "Senior
-- Designer", "Video Editor", "Project Manager").
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

alter table public.profiles
  add column if not exists title text;

comment on column public.profiles.title is
  'Optional job title / specialty displayed on the team page and workspace member lists.';

-- ============================================================
-- ✅ PHASE 7 MIGRATION COMPLETE
-- ============================================================
-- After running, verify the `title` column appears in
-- Supabase Dashboard → Table Editor → profiles.
-- ============================================================
