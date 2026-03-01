'use server'

import { createClient } from '@/lib/supabase/server'

// ── Save metadata after a client-side upload ──────────────────────────────

export async function saveAssetMetadata(data: {
  workspaceId: string
  fileName: string
  storagePath: string
  fileSize: number
  fileType: string
  category: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', asset: null }

  const { data: asset, error } = await supabase
    .from('workspace_assets')
    .insert({
      workspace_id: data.workspaceId,
      file_name:    data.fileName,
      storage_path: data.storagePath,
      file_size:    data.fileSize,
      file_type:    data.fileType,
      category:     data.category as 'logos' | 'guidelines' | 'source_files' | 'other',
      uploaded_by:  user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message, asset: null }
  return { error: null, asset }
}

// ── Signed URL for download or preview ───────────────────────────────────

export async function getAssetSignedUrl(
  storagePath: string,
  forDownload = false
) {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from('workspace_assets')
    .createSignedUrl(storagePath, 3600, forDownload ? { download: true } : undefined)

  if (error) return { url: null, error: error.message }
  return { url: data.signedUrl, error: null }
}

// ── Batch signed URLs for image previews ─────────────────────────────────

export async function getAssetPreviewUrls(paths: string[]) {
  if (paths.length === 0) return {}
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from('workspace_assets')
    .createSignedUrls(paths, 3600)

  if (error || !data) return {}
  return Object.fromEntries(data.map((d) => [d.path, d.signedUrl]))
}

// ── Delete an asset (DB row + storage object) ────────────────────────────

export async function deleteAsset(assetId: string, storagePath: string) {
  const supabase = await createClient()

  const { error: storageErr } = await supabase.storage
    .from('workspace_assets')
    .remove([storagePath])

  if (storageErr) return { error: storageErr.message }

  const { error: dbErr } = await supabase
    .from('workspace_assets')
    .delete()
    .eq('id', assetId)

  if (dbErr) return { error: dbErr.message }
  return { error: null }
}
