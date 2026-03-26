-- ============================================================
-- Clikaa Client Portal — Workspace Logo
-- Adds logo_url to workspaces + creates workspace-logos bucket.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Table: add logo_url column ─────────────────────────────────────────────

alter table public.workspaces
  add column if not exists logo_url text default null;

-- ── Storage bucket (public — logos referenced via public URL) ──────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-logos',
  'workspace-logos',
  true,          -- public bucket: logo images are served without auth
  5242880,       -- 5 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do nothing;

-- Only admins can upload / replace logo objects
create policy "Admins can upload workspace logos"
  on storage.objects for insert
  with check (
    bucket_id = 'workspace-logos'
    and auth.role() = 'authenticated'
    and is_admin()
  );

create policy "Admins can update workspace logos"
  on storage.objects for update
  using (
    bucket_id = 'workspace-logos'
    and auth.role() = 'authenticated'
    and is_admin()
  );

create policy "Admins can delete workspace logos"
  on storage.objects for delete
  using (
    bucket_id = 'workspace-logos'
    and auth.role() = 'authenticated'
    and is_admin()
  );

-- Public bucket objects are readable by everyone (no select policy needed).

-- ============================================================
-- ✅ MIGRATION COMPLETE
-- ============================================================
