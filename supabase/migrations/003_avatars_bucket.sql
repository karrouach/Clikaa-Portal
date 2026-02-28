-- ============================================================
-- Clikaa Client Portal — Phase 6: Avatar Storage
-- Creates the public `avatars` bucket and scoped RLS policies.
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================


-- ─── 1. Public storage bucket ─────────────────────────────────────────────────
-- public = true means the /storage/v1/object/public/ endpoint serves files
-- without authentication. Users can view any profile picture without a JWT.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;


-- ─── 2. Storage RLS policies ──────────────────────────────────────────────────
-- Path format: {userId}/{filename}  (e.g. "uuid-here/avatar")
-- (storage.foldername(name))[1] extracts the first path segment (the userId).
-- We cast auth.uid() to text because storage.objects columns are text, not uuid.

-- Drop if re-running.
drop policy if exists "avatars — users upload own"   on storage.objects;
drop policy if exists "avatars — users update own"   on storage.objects;
drop policy if exists "avatars — users delete own"   on storage.objects;

-- INSERT: authenticated users may only write into their own UID folder.
create policy "avatars — users upload own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- UPDATE: same scope (for upsert / replace).
create policy "avatars — users update own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- DELETE: users may only remove their own avatars.
create policy "avatars — users delete own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ─── 3. profiles.avatar_url ───────────────────────────────────────────────────
-- This column was created in Phase 1 (001_initial_schema.sql).
-- The statement below is a no-op safety net in case the column is missing.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'avatar_url'
  ) then
    alter table public.profiles add column avatar_url text;
  end if;
end;
$$;


-- ============================================================
-- ✅ PHASE 6 MIGRATION COMPLETE
-- ============================================================
-- After running:
-- 1. Verify the `avatars` bucket appears in
--    Supabase Dashboard → Storage with Public = true.
-- 2. Verify the three storage policies appear under
--    Storage → Policies.
-- ============================================================
