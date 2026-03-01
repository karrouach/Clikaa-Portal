-- ============================================================
-- Clikaa Client Portal — Phase 8: Workspace Assets (Asset Vault)
-- Creates a workspace_assets table and matching Storage bucket
-- so admins can upload brand files (logos, guidelines, source
-- files) that clients can browse and download.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Table ──────────────────────────────────────────────────────────────────

create table if not exists public.workspace_assets (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  file_name     text        not null,
  storage_path  text        not null,
  file_size     bigint      not null default 0,
  file_type     text        not null default '',
  category      text        not null default 'other'
                            check (category in ('logos', 'guidelines', 'source_files', 'other')),
  uploaded_by   uuid        not null references public.profiles(id),
  created_at    timestamptz not null default now()
);

comment on table public.workspace_assets is
  'Brand and project assets uploaded by admins and shared with workspace members.';

-- ── RLS ───────────────────────────────────────────────────────────────────

alter table public.workspace_assets enable row level security;

-- Workspace members (admin + client) can read assets in their workspaces.
create policy "Workspace members can read assets"
  on public.workspace_assets for select
  using (is_workspace_member(workspace_id));

-- Only admins can insert assets.
create policy "Admins can upload assets"
  on public.workspace_assets for insert
  with check (is_admin() and is_workspace_member(workspace_id));

-- Only admins can delete assets.
create policy "Admins can delete assets"
  on public.workspace_assets for delete
  using (is_admin() and is_workspace_member(workspace_id));

-- ── Storage bucket ────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace_assets',
  'workspace_assets',
  false,          -- private bucket — access via signed URLs only
  52428800,       -- 50 MB per file
  null            -- all mime types allowed
)
on conflict (id) do nothing;

-- Storage object RLS:
-- Files are stored at: {workspace_id}/{timestamp}-{filename}
-- The first folder segment is the workspace UUID.

create policy "Workspace members can read asset objects"
  on storage.objects for select
  using (
    bucket_id = 'workspace_assets'
    and auth.role() = 'authenticated'
    and is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "Admins can upload asset objects"
  on storage.objects for insert
  with check (
    bucket_id = 'workspace_assets'
    and auth.role() = 'authenticated'
    and is_admin()
    and is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "Admins can delete asset objects"
  on storage.objects for delete
  using (
    bucket_id = 'workspace_assets'
    and auth.role() = 'authenticated'
    and is_admin()
    and is_workspace_member((storage.foldername(name))[1]::uuid)
  );

-- ============================================================
-- ✅ PHASE 8 MIGRATION COMPLETE
-- ============================================================
-- After running, verify:
--   1. workspace_assets table appears in Table Editor → workspace_assets
--   2. workspace_assets bucket appears in Storage
--   3. RLS policies are active on both the table and storage objects
-- ============================================================
