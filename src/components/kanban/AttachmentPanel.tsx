'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  saveAttachmentMetadata,
  getSignedUrl,
  deleteAttachment,
} from '@/app/dashboard/attachment-actions'
import type { AttachmentWithUploader } from '@/types/database'
import type { CurrentUserProfile } from './TaskDetailSheet'
import { formatRelativeTime, formatFileSize } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  File,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  Upload,
  Download,
  X,
  Loader2,
} from 'lucide-react'

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB

interface AttachmentPanelProps {
  taskId: string
  workspaceId: string
  currentUserProfile: CurrentUserProfile
}

// ── File type → Lucide icon ───────────────────────────────────────────────────
function FileIcon({ fileType }: { fileType: string }) {
  const props = { size: 14, strokeWidth: 1.5, className: 'shrink-0 text-zinc-400' }
  if (fileType.startsWith('image/')) return <ImageIcon {...props} />
  if (fileType.startsWith('video/')) return <Video {...props} />
  if (fileType.startsWith('audio/')) return <Music {...props} />
  if (fileType === 'application/pdf') return <FileText {...props} />
  if (fileType.startsWith('text/')) return <FileText {...props} />
  if (
    fileType.includes('zip') ||
    fileType.includes('tar') ||
    fileType.includes('rar') ||
    fileType.includes('7z')
  )
    return <Archive {...props} />
  return <File {...props} />
}

// Replaces any character that isn't alphanumeric, dot, dash, or underscore.
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// ── AttachmentPanel ───────────────────────────────────────────────────────────
export function AttachmentPanel({
  taskId,
  workspaceId,
  currentUserProfile,
}: AttachmentPanelProps) {
  const [attachments, setAttachments] = useState<AttachmentWithUploader[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  // Map of tempId → fileName for in-progress uploads
  const [uploading, setUploading] = useState<Map<string, string>>(new Map())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isAdmin = currentUserProfile.role === 'admin'

  // ── Fetch + Realtime ────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function fetchInitial() {
      const { data } = await supabase
        .from('attachments')
        .select('*, profiles (full_name, email)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

      if (mounted) {
        setAttachments((data as unknown as AttachmentWithUploader[]) ?? [])
        setIsLoading(false)
      }
    }

    fetchInitial()

    // Listen for other users adding attachments in real time
    const channel = supabase
      .channel(`task:${taskId}:attachments`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attachments',
          filter: `task_id=eq.${taskId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('attachments')
            .select('*, profiles (full_name, email)')
            .eq('id', (payload.new as { id: string }).id)
            .single()

          if (data && mounted) {
            setAttachments((prev) => {
              if (prev.some((a) => a.id === (data as { id: string }).id)) return prev
              return [...prev, data as unknown as AttachmentWithUploader]
            })
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [taskId])

  // ── Upload ──────────────────────────────────────────────────────────────────
  const uploadFiles = useCallback(
    async (files: File[]) => {
      const supabase = createClient()

      for (const file of files) {
        if (file.size > MAX_FILE_BYTES) {
          alert(`"${file.name}" exceeds the 50 MB limit and was skipped.`)
          continue
        }

        const tempId = `${Date.now()}-${Math.random()}`
        const sanitized = sanitizeName(file.name)
        // Path: workspaceId/taskId/timestamp-filename
        const storagePath = `${workspaceId}/${taskId}/${Date.now()}-${sanitized}`

        setUploading((prev) => new Map(prev).set(tempId, file.name))

        const { error: storageError } = await supabase.storage
          .from('task-attachments')
          .upload(storagePath, file, { upsert: false })

        if (storageError) {
          setUploading((prev) => {
            const next = new Map(prev)
            next.delete(tempId)
            return next
          })
          alert(`Failed to upload "${file.name}": ${storageError.message}`)
          continue
        }

        const result = await saveAttachmentMetadata({
          taskId,
          fileName: file.name,
          storagePath,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
        })

        setUploading((prev) => {
          const next = new Map(prev)
          next.delete(tempId)
          return next
        })

        if (result.attachment) {
          setAttachments((prev) => {
            if (prev.some((a) => a.id === result.attachment!.id)) return prev
            return [...prev, result.attachment!]
          })
        }
      }
    },
    [taskId, workspaceId]
  )

  // ── Drag handlers ───────────────────────────────────────────────────────────
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) uploadFiles(files)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) uploadFiles(files)
    e.target.value = '' // Reset so the same file can be re-picked
  }

  // ── Download ────────────────────────────────────────────────────────────────
  async function handleDownload(att: AttachmentWithUploader) {
    setDownloadingId(att.id)
    const result = await getSignedUrl(att.storage_path)
    setDownloadingId(null)

    if (result.url) {
      // Create a temporary anchor that triggers a download
      const a = document.createElement('a')
      a.href = result.url
      a.download = att.file_name
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(att: AttachmentWithUploader) {
    setDeletingId(att.id)
    const result = await deleteAttachment(att.id, att.storage_path)
    if (!result.error) {
      setAttachments((prev) => prev.filter((a) => a.id !== att.id))
    }
    setDeletingId(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* ── File list ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-1">
          <Loader2 size={12} strokeWidth={1.5} className="animate-spin text-zinc-300" />
          <span className="text-xs text-zinc-400">Loading…</span>
        </div>
      ) : attachments.length === 0 && uploading.size === 0 ? (
        <p className="text-xs text-zinc-400 py-1">No files attached yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {/* Existing attachments */}
          {attachments.map((att) => {
            const canDelete = isAdmin || att.uploaded_by === currentUserProfile.id
            const isDownloading = downloadingId === att.id
            const isDeleting = deletingId === att.id

            return (
              <li
                key={att.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-50 group"
              >
                <FileIcon fileType={att.file_type} />

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-black truncate leading-none">{att.file_name}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {formatFileSize(att.file_size)} · {formatRelativeTime(att.created_at)}
                  </p>
                </div>

                {/* Download */}
                <button
                  onClick={() => handleDownload(att)}
                  disabled={isDownloading || isDeleting}
                  title="Download"
                  className="
                    shrink-0 w-6 h-6 flex items-center justify-center rounded
                    text-zinc-400 hover:text-black hover:bg-zinc-100
                    transition-colors disabled:opacity-30
                  "
                >
                  {isDownloading ? (
                    <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
                  ) : (
                    <Download size={11} strokeWidth={1.5} />
                  )}
                </button>

                {/* Delete — visible on hover if authorised */}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(att)}
                    disabled={isDeleting || isDownloading}
                    title="Delete"
                    className="
                      shrink-0 w-6 h-6 flex items-center justify-center rounded
                      text-zinc-400 hover:text-red-500 hover:bg-red-50
                      transition-colors opacity-0 group-hover:opacity-100
                      disabled:opacity-30
                    "
                  >
                    {isDeleting ? (
                      <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
                    ) : (
                      <X size={11} strokeWidth={1.5} />
                    )}
                  </button>
                )}
              </li>
            )
          })}

          {/* In-progress uploads */}
          {Array.from(uploading.entries()).map(([tempId, fileName]) => (
            <li key={tempId} className="flex items-center gap-2 px-2 py-1.5 opacity-60">
              <Loader2
                size={14}
                strokeWidth={1.5}
                className="shrink-0 text-zinc-400 animate-spin"
              />
              <p className="text-xs text-black truncate flex-1">{fileName}</p>
              <span className="text-[10px] text-zinc-400 shrink-0">Uploading…</span>
            </li>
          ))}
        </ul>
      )}

      {/* ── Dropzone ─────────────────────────────────────────────────────────── */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 cursor-pointer rounded',
          'border border-dashed transition-colors duration-150',
          isDragging
            ? 'border-black bg-zinc-50'
            : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'
        )}
      >
        <Upload size={13} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
        <div>
          <p className="text-xs text-zinc-500 leading-none">
            Drop files or{' '}
            <span className="text-black font-medium">click to upload</span>
          </p>
          <p className="text-[10px] text-zinc-400 mt-0.5">Max 50 MB per file</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  )
}
