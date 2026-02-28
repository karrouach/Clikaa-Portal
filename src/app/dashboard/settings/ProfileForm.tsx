'use client'

import { useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateProfile } from './actions'
import { getInitials } from '@/lib/utils'
import { Camera, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileFormProps {
  userId: string
  initialFullName: string
  initialTitle: string | null
  email: string
  role: string
  initialAvatarUrl: string | null
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB

export function ProfileForm({
  userId,
  initialFullName,
  initialTitle,
  email,
  role,
  initialAvatarUrl,
}: ProfileFormProps) {
  const [fullName, setFullName]           = useState(initialFullName)
  const [title, setTitle]                 = useState(initialTitle ?? '')
  const [avatarSrc, setAvatarSrc]         = useState<string | null>(initialAvatarUrl)
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading]     = useState(false)
  const [isPending, startTransition]      = useTransition()
  const [error, setError]                 = useState<string | null>(null)
  const [success, setSuccess]             = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = getInitials(fullName || email)

  // ── Avatar upload ──────────────────────────────────────────────────────────
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so same file can be re-picked
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Image must be under 2 MB.')
      return
    }

    // Show a local preview immediately.
    const localPreview = URL.createObjectURL(file)
    setAvatarSrc(localPreview)
    setIsUploading(true)
    setError(null)

    const supabase = createClient()
    // Always write to the same path so we never accumulate stale files.
    const storagePath = `${userId}/avatar`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      // Revert preview on failure.
      setAvatarSrc(initialAvatarUrl)
      setError(`Avatar upload failed: ${uploadError.message}`)
      setIsUploading(false)
      return
    }

    // Get the public URL and append a cache-buster so the browser always
    // fetches the freshest version even though the path hasn't changed.
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(storagePath)

    const freshUrl = `${publicUrl}?t=${Date.now()}`
    setPendingAvatarUrl(freshUrl)
    setAvatarSrc(freshUrl)
    setIsUploading(false)
  }

  // ── Profile save ───────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const result = await updateProfile({
        fullName,
        title: title.trim() || null,
        avatarUrl: pendingAvatarUrl ?? undefined,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        // Clear the pending URL — it's now persisted.
        setPendingAvatarUrl(null)
      }
    })
  }

  const isBusy = isUploading || isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Avatar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="relative group w-20 h-20 rounded-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          aria-label="Upload profile photo"
        >
          {/* Photo or initials fallback */}
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={fullName || email}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-zinc-500 text-lg font-semibold select-none">
              {initials}
            </div>
          )}

          {/* Hover / loading overlay */}
          <div
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center gap-1',
              'bg-black/50 text-white',
              'transition-opacity duration-150',
              isUploading
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            )}
          >
            {isUploading ? (
              <Loader2 size={18} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <>
                <Camera size={18} strokeWidth={1.5} />
                <span className="text-[10px] font-medium tracking-wide">Update</span>
              </>
            )}
          </div>
        </button>

        <p className="text-xs text-zinc-400">JPG, PNG or GIF · max 2 MB</p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* ── Fields ────────────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {/* Full name */}
        <div className="space-y-1.5">
          <label
            htmlFor="full_name"
            className="block text-xs font-medium text-zinc-700 tracking-wide uppercase"
          >
            Full name
          </label>
          <input
            id="full_name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
            className="
              w-full h-10 px-0 py-2
              border-0 border-b border-zinc-200
              bg-transparent text-sm text-black placeholder:text-zinc-400
              focus:outline-none focus:border-black
              transition-colors duration-150
            "
          />
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label
            htmlFor="title"
            className="block text-xs font-medium text-zinc-700 tracking-wide uppercase"
          >
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior Designer, Project Manager"
            className="
              w-full h-10 px-0 py-2
              border-0 border-b border-zinc-200
              bg-transparent text-sm text-black placeholder:text-zinc-400
              focus:outline-none focus:border-black
              transition-colors duration-150
            "
          />
        </div>

        {/* Email — read-only */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-medium text-zinc-700 tracking-wide uppercase"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            disabled
            value={email}
            className="
              w-full h-10 px-0 py-2
              border-0 border-b border-zinc-100
              bg-transparent text-sm text-zinc-400
              cursor-not-allowed
            "
          />
        </div>

        {/* Role — read-only badge */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-zinc-700 tracking-wide uppercase">Role</p>
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 capitalize">
            {role}
          </span>
        </div>
      </div>

      {/* ── Feedback ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 text-red-700 text-sm">
          <AlertCircle size={15} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 p-3 bg-green-50 border border-green-100 text-green-700 text-sm">
          <CheckCircle size={15} strokeWidth={1.5} className="shrink-0" />
          <span>Profile updated successfully.</span>
        </div>
      )}

      {/* ── Submit ────────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={isBusy}
        className="
          h-10 px-6 flex items-center gap-2
          bg-black text-white text-sm font-medium tracking-wide
          hover:bg-zinc-800 active:bg-zinc-900
          transition-colors duration-150
          disabled:opacity-60 disabled:cursor-not-allowed
        "
      >
        {isPending ? (
          <>
            <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
            Saving…
          </>
        ) : (
          'Save Changes'
        )}
      </button>
    </form>
  )
}
