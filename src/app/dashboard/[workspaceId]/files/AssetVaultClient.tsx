'use client'

import { useState, useRef, useTransition } from 'react'
import {
  Upload, Download, Trash2, File, FileText, FileImage,
  Archive, Plus, Loader2, AlertCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import {
  saveAssetMetadata,
  getAssetSignedUrl,
  deleteAsset,
} from './asset-actions'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

export type AssetItem = {
  id: string
  file_name: string
  storage_path: string
  file_size: number
  file_type: string
  category: string
  created_at: string
  previewUrl: string | null
}

interface Props {
  workspaceId: string
  initialAssets: AssetItem[]
  isAdmin: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'all',          label: 'All' },
  { value: 'logos',        label: 'Logos' },
  { value: 'guidelines',   label: 'Guidelines' },
  { value: 'source_files', label: 'Source Files' },
] as const

const UPLOAD_CATEGORIES = [
  { value: 'logos',        label: 'Logos' },
  { value: 'guidelines',   label: 'Guidelines' },
  { value: 'source_files', label: 'Source Files' },
  { value: 'other',        label: 'Other' },
] as const

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/'))   return FileImage
  if (fileType.includes('pdf'))        return FileText
  if (fileType.includes('zip') || fileType.includes('archive') || fileType.includes('compressed')) return Archive
  return File
}

function getIconBg(fileType: string): string {
  if (fileType.startsWith('image/'))   return 'bg-violet-50 text-violet-400'
  if (fileType.includes('pdf'))        return 'bg-red-50 text-red-400'
  if (fileType.includes('zip') || fileType.includes('archive')) return 'bg-amber-50 text-amber-400'
  return 'bg-zinc-100 text-zinc-400'
}

// ─── File Card ───────────────────────────────────────────────────────────────

function FileCard({
  asset,
  isAdmin,
  onDelete,
}: {
  asset: AssetItem
  isAdmin: boolean
  onDelete: (id: string) => void
}) {
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting]       = useState(false)

  const isImage = asset.file_type.startsWith('image/')
  const Icon    = getFileIcon(asset.file_type)

  async function handleDownload() {
    setDownloading(true)
    const { url, error } = await getAssetSignedUrl(asset.storage_path, true)
    setDownloading(false)
    if (error || !url) return
    const a = document.createElement('a')
    a.href = url
    a.download = asset.file_name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${asset.file_name}"?`)) return
    setDeleting(true)
    const { error } = await deleteAsset(asset.id, asset.storage_path)
    setDeleting(false)
    if (!error) onDelete(asset.id)
  }

  return (
    <div className="group bg-white border border-zinc-100 rounded-xl overflow-hidden flex flex-col hover:border-zinc-200 hover:shadow-md transition-all duration-200">
      {/* ── Preview area ──────────────────────────────────────────────── */}
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-50 shrink-0">
        {isImage && asset.previewUrl ? (
          <img
            src={asset.previewUrl}
            alt={asset.file_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={cn('w-full h-full flex items-center justify-center', getIconBg(asset.file_type))}>
            <Icon size={36} strokeWidth={1} />
          </div>
        )}

        {/* Category badge */}
        <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 text-white text-[9px] font-medium uppercase tracking-widest backdrop-blur-sm">
          {asset.category.replace('_', ' ')}
        </span>

        {/* Admin delete button — appears on hover */}
        {isAdmin && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="absolute top-2 right-2 w-7 h-7 bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm hover:bg-red-600 disabled:opacity-50"
            aria-label="Delete asset"
          >
            {deleting
              ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
              : <Trash2  size={12} strokeWidth={1.5} />
            }
          </button>
        )}
      </div>

      {/* ── File info ─────────────────────────────────────────────────── */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-black truncate leading-snug">
            {asset.file_name}
          </p>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {formatSize(asset.file_size)}
          </p>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-1.5 h-8 bg-black text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-60"
        >
          {downloading
            ? <Loader2  size={12} strokeWidth={1.5} className="animate-spin" />
            : <Download size={12} strokeWidth={1.5} />
          }
          {downloading ? 'Preparing…' : 'Download'}
        </button>
      </div>
    </div>
  )
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({
  open,
  onClose,
  workspaceId,
  onUploaded,
}: {
  open: boolean
  onClose: () => void
  workspaceId: string
  onUploaded: (asset: AssetItem) => void
}) {
  const fileRef   = useRef<HTMLInputElement>(null)
  const [file,     setFile]     = useState<File | null>(null)
  const [category, setCategory] = useState('logos')
  const [error,    setError]    = useState<string | null>(null)
  const [isPending, start]      = useTransition()

  function reset() {
    setFile(null)
    setCategory('logos')
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleClose() {
    if (isPending) return
    reset()
    onClose()
  }

  async function handleUpload() {
    if (!file) return
    setError(null)

    const supabase   = createClient()
    const timestamp  = Date.now()
    const sanitized  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${workspaceId}/${timestamp}-${sanitized}`

    start(async () => {
      // 1. Upload to Supabase Storage directly from browser
      const { error: uploadErr } = await supabase.storage
        .from('workspace_assets')
        .upload(storagePath, file, { contentType: file.type, upsert: false })

      if (uploadErr) { setError(uploadErr.message); return }

      // 2. Save metadata to DB via server action
      const { asset, error: metaErr } = await saveAssetMetadata({
        workspaceId,
        fileName:    file.name,
        storagePath,
        fileSize:    file.size,
        fileType:    file.type,
        category,
      })

      if (metaErr || !asset) { setError(metaErr ?? 'Failed to save metadata'); return }

      // 3. Get preview URL for images so card renders immediately
      let previewUrl: string | null = null
      if (file.type.startsWith('image/')) {
        const { url } = await getAssetSignedUrl(storagePath, false)
        previewUrl = url
      }

      onUploaded({ ...asset, previewUrl })
      handleClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Upload Asset</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
              <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* File picker */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-zinc-600 uppercase tracking-widest">
              File
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-zinc-200 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
            >
              <Upload size={20} strokeWidth={1.5} className="text-zinc-400" />
              {file ? (
                <>
                  <p className="text-sm font-medium text-black truncate max-w-full px-4">{file.name}</p>
                  <p className="text-xs text-zinc-400">{formatSize(file.size)}</p>
                </>
              ) : (
                <p className="text-sm text-zinc-400">Click to choose a file</p>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-zinc-600 uppercase tracking-widest">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-transparent text-sm text-black border-0 border-b border-zinc-200 focus:outline-none focus:border-black transition-colors h-9 cursor-pointer appearance-none"
            >
              {UPLOAD_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1 border-t border-zinc-100">
            <button
              onClick={handleClose}
              disabled={isPending}
              className="flex-1 h-9 text-sm text-zinc-500 hover:text-black transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || isPending}
              className="flex-1 h-9 flex items-center justify-center gap-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending && <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />}
              {isPending ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── AssetVaultClient ─────────────────────────────────────────────────────────

export function AssetVaultClient({ workspaceId, initialAssets, isAdmin }: Props) {
  const [assets,       setAssets]       = useState<AssetItem[]>(initialAssets)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [uploadOpen,   setUploadOpen]   = useState(false)

  const filtered = activeFilter === 'all'
    ? assets
    : assets.filter((a) => a.category === activeFilter)

  function handleUploaded(asset: AssetItem) {
    setAssets((prev) => [asset, ...prev])
  }

  function handleDeleted(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 gap-4">
        {/* Category filters */}
        <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveFilter(cat.value)}
              className={cn(
                'shrink-0 px-3 h-8 text-xs font-medium transition-colors rounded-lg',
                activeFilter === cat.value
                  ? 'bg-black text-white'
                  : 'text-zinc-500 hover:text-black hover:bg-zinc-100'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Admin: upload button */}
        {isAdmin && (
          <button
            onClick={() => setUploadOpen(true)}
            className="shrink-0 flex items-center gap-1.5 h-8 px-4 bg-black text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Plus size={13} strokeWidth={1.5} />
            Upload Asset
          </button>
        )}
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 bg-zinc-100 flex items-center justify-center mb-4">
            <File size={20} strokeWidth={1.5} className="text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-black">
            {activeFilter === 'all' ? 'No assets yet' : `No ${activeFilter.replace('_', ' ')} yet`}
          </p>
          {isAdmin && activeFilter === 'all' && (
            <p className="mt-1 text-sm text-zinc-500 max-w-xs">
              Upload brand files for your client — logos, guidelines, source files.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map((asset) => (
            <FileCard
              key={asset.id}
              asset={asset}
              isAdmin={isAdmin}
              onDelete={handleDeleted}
            />
          ))}
        </div>
      )}

      {/* ── Upload modal ─────────────────────────────────────────────────── */}
      {isAdmin && (
        <UploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          workspaceId={workspaceId}
          onUploaded={handleUploaded}
        />
      )}
    </>
  )
}
