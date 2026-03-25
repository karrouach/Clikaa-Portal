-- ============================================================
-- Clikaa Client Portal — Fix: Client Upload Permissions
-- Allows workspace members (not just admins) to upload assets.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Table: replace admin-only INSERT with workspace-member INSERT ──────────

drop policy if exists "Admins can upload assets" on public.workspace_assets;

create policy "Workspace members can upload assets"
  on public.workspace_assets for insert
  with check (
    auth.role() = 'authenticated'
    and is_workspace_member(workspace_id)
  );

-- ── Storage: replace admin-only INSERT with workspace-member INSERT ────────

drop policy if exists "Admins can upload asset objects" on storage.objects;

create policy "Workspace members can upload asset objects"
  on storage.objects for insert
  with check (
    bucket_id = 'workspace_assets'
    and auth.role() = 'authenticated'
    and is_workspace_member((storage.foldername(name))[1]::uuid)
  );

-- ============================================================
-- ✅ MIGRATION COMPLETE
-- ============================================================
-- After running, verify:
--   1. Clients can upload files via Asset Vault
--   2. Admins retain delete permissions (unchanged)
-- ============================================================
