-- ============================================================
-- Clikaa Client Portal — Phase 5: File Attachments
-- Replaces the placeholder `attachments` table from Phase 1
-- with the full schema for Supabase Storage integration.
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- Safe to re-run (idempotent).
-- ============================================================


-- ─── 1. Replace attachments table ────────────────────────────────────────────
-- CASCADE drops the Phase 1 policies and indexes automatically.
drop table if exists public.attachments cascade;

-- New table: stores per-file metadata for objects in `task-attachments` bucket.
create table public.attachments (
  id            uuid        primary key default gen_random_uuid(),
  task_id       uuid        not null references public.tasks(id) on delete cascade,
  file_name     text        not null,                              -- original filename for display
  storage_path  text        not null unique,                       -- bucket path: workspaceId/taskId/ts-name
  file_size     bigint      not null default 0,                    -- bytes
  file_type     text        not null default 'application/octet-stream', -- MIME type
  uploaded_by   uuid        not null references public.profiles(id),
  created_at    timestamptz not null default now()
);

comment on table  public.attachments              is 'File metadata for objects stored in the task-attachments storage bucket.';
comment on column public.attachments.storage_path is 'Bucket-relative path. Format: {workspaceId}/{taskId}/{timestamp}-{filename}.';
comment on column public.attachments.file_type    is 'MIME type (e.g. image/png, application/pdf).';

create index idx_attachments_task_id on public.attachments (task_id);


-- ─── 2. Row Level Security ────────────────────────────────────────────────────
alter table public.attachments enable row level security;

-- Workspace members can read attachment metadata on tasks they can see.
create policy "attachments — select"
  on public.attachments
  for select
  to authenticated
  using (
    public.is_admin()
    or public.is_workspace_member(public.get_task_workspace_id(task_id))
  );

-- Any workspace member can add an attachment record.
create policy "attachments — insert"
  on public.attachments
  for insert
  to authenticated
  with check (
    public.is_admin()
    or public.is_workspace_member(public.get_task_workspace_id(task_id))
  );

-- Uploaders can remove their own; admins can remove any.
create policy "attachments — delete"
  on public.attachments
  for delete
  to authenticated
  using (
    public.is_admin()
    or uploaded_by = auth.uid()
  );


-- ─── 3. Realtime ──────────────────────────────────────────────────────────────
-- Re-add to publication (the CASCADE drop removed the old entry).
alter publication supabase_realtime add table public.attachments;


-- ─── 4. Storage policies ──────────────────────────────────────────────────────
-- Drop OLD policy names from Phase 1 (may or may not exist).
drop policy if exists "storage — workspace members can upload" on storage.objects;
drop policy if exists "storage — authenticated users can read"  on storage.objects;
drop policy if exists "storage — uploader or admin can delete"  on storage.objects;

-- Drop NEW policy names too, so this script is safe to re-run.
drop policy if exists "storage — workspace members can read"  on storage.objects;
drop policy if exists "storage — owner or admin can delete"   on storage.objects;

-- Path format: {workspaceId}/{taskId}/{timestamp}-{filename}
-- storage.foldername(name) → TEXT[] where element [1] = workspaceId, [2] = taskId

-- SELECT: workspace member of the folder's workspace.
create policy "storage — workspace members can read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

-- INSERT: workspace member may upload to their workspace folder.
create policy "storage — workspace members can upload"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'task-attachments'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

-- DELETE: file owner or global admin.
-- FIX: storage.objects.owner_id is type TEXT, not UUID.
--      auth.uid() returns UUID, so we must cast to text before comparing.
create policy "storage — owner or admin can delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and (
      public.is_admin()
      or auth.uid()::text = owner_id
    )
  );


-- ============================================================
-- ✅ PHASE 5 MIGRATION COMPLETE
-- ============================================================
-- After running:
-- 1. Verify `task-attachments` bucket exists in
--    Supabase Dashboard → Storage (public = false).
--    If it does not exist, create it there manually.
-- 2. Verify the three new storage policies appear under
--    Storage → Policies.
-- ============================================================
