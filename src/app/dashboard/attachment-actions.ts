'use server'

import { createClient } from '@/lib/supabase/server'
import type { AttachmentWithUploader } from '@/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// saveAttachmentMetadata
// Called after the client has successfully uploaded a file to Storage.
// Persists the metadata row to the `attachments` table.
// ─────────────────────────────────────────────────────────────────────────────
export type SaveAttachmentResult = {
  attachment?: AttachmentWithUploader
  error?: string
}

export async function saveAttachmentMetadata({
  taskId,
  fileName,
  storagePath,
  fileSize,
  fileType,
}: {
  taskId: string
  fileName: string
  storagePath: string
  fileSize: number
  fileType: string
}): Promise<SaveAttachmentResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised.' }

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      task_id: taskId,
      file_name: fileName,
      storage_path: storagePath,
      file_size: fileSize,
      file_type: fileType || 'application/octet-stream',
      uploaded_by: user.id,
    })
    .select('*, profiles (full_name, email)')
    .single()

  if (error) return { error: error.message }
  return { attachment: data as unknown as AttachmentWithUploader }
}

// ─────────────────────────────────────────────────────────────────────────────
// getSignedUrl
// Generates a 1-hour signed URL for a private storage object.
// Storage RLS SELECT policy ensures only workspace members can call this.
// ─────────────────────────────────────────────────────────────────────────────
export async function getSignedUrl(
  storagePath: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised.' }

  const { data, error } = await supabase.storage
    .from('task-attachments')
    .createSignedUrl(storagePath, 3600) // 1-hour expiry

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteAttachment
// Removes the Storage object first, then the metadata row.
// RLS on both ensures only the uploader or an admin can delete.
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteAttachment(
  attachmentId: string,
  storagePath: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised.' }

  // Delete the actual file from Storage first.
  const { error: storageError } = await supabase.storage
    .from('task-attachments')
    .remove([storagePath])

  if (storageError) return { error: storageError.message }

  // Delete the metadata row.
  const { error: dbError } = await supabase
    .from('attachments')
    .delete()
    .eq('id', attachmentId)

  if (dbError) return { error: dbError.message }
  return {}
}
