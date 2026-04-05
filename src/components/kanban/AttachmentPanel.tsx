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
import { formatFileSize } from '@/lib/utils'
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
    e.target.value = ''
  }

  // ── Download ────────────────────────────────────────────────────────────────
  async function handleDownload(att: AttachmentWithUploader) {
    setDownloadingId(att.id)
    const result = await getSignedUrl(att.storage_path)
    setDownloadingId(null)
    if (result.url) {
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
    <div className="space-y-3">

      {/* ── Section header ───────────────────────────────────────────────────── */}
      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
        Attachments{attachments.length > 0 ? ` (${attachments.length})` : ''}
      </p>

      {/* ── Existing file list ───────────────────────────────────────────────── */}
      {!isLoading && (attachments.length > 0 || uploading.size > 0) && (
        <ul className="space-y-0.5">
          {attachments.map((att) => {
            const canDelete = isAdmin || att.uploaded_by === currentUserProfile.id
            const isDownloading = downloadingId === att.id
            const isDeleting = deletingId === att.id

            return (
              <li
                key={att.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 group"
              >
                <FileIcon fileType={att.file_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-black dark:text-white truncate leading-none">{att.file_name}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{formatFileSize(att.file_size)}</p>
                </div>

                <button
                  onClick={() => handleDownload(att)}
                  disabled={isDownloading || isDeleting}
                  title="Download"
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-30"
                >
                  {isDownloading
                    ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
                    : <Download size={11} strokeWidth={1.5} />
                  }
                </button>

                {canDelete && (
                  <button
                    onClick={() => handleDelete(att)}
                    disabled={isDeleting || isDownloading}
                    title="Delete"
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-30"
                  >
                    {isDeleting
                      ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
                      : <X size={11} strokeWidth={1.5} />
                    }
                  </button>
                )}
              </li>
            )
          })}

          {Array.from(uploading.entries()).map(([tempId, fileName]) => (
            <li key={tempId} className="flex items-center gap-2 px-2 py-1.5 opacity-60">
              <Loader2 size={14} strokeWidth={1.5} className="shrink-0 text-zinc-400 animate-spin" />
              <p className="text-xs text-black dark:text-white truncate flex-1">{fileName}</p>
              <span className="text-[10px] text-zinc-400 shrink-0">Uploading…</span>
            </li>
          ))}
        </ul>
      )}

      {/* ── Large dropzone ───────────────────────────────────────────────────── */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'cursor-pointer rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3 text-center transition-colors duration-150',
          isDragging
            ? 'border-zinc-400 dark:border-zinc-500 bg-zinc-50 dark:bg-zinc-800'
            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20'
        )}
      >
        {isLoading ? (
          <Loader2 size={20} strokeWidth={1.5} className="text-zinc-300 animate-spin" />
        ) : (
          <>
            <Upload size={20} strokeWidth={1.5} className="text-zinc-300 dark:text-zinc-600" />
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-snug">
                Drop files here or{' '}
                <span className="text-black dark:text-white font-medium">click to upload</span>
              </p>
              <p className="text-xs text-zinc-400 mt-1">Max 50 MB per file</p>
            </div>
          </>
        )}
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
