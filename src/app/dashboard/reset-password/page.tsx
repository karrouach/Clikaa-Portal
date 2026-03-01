'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

// ─── Inner component (needs useSearchParams → must be inside Suspense) ────────

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // The callback route passes ?type=invite or ?type=recovery so we can
  // tailor the heading and sub-heading to the user's context.
  const type = searchParams.get('type') // 'invite' | 'recovery' | null
  const isInvite   = type === 'invite'
  const isRecovery = type === 'recovery'

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [done,      setDone]      = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setIsPending(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setIsPending(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  // ── Success state ────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="w-full max-w-sm mx-auto px-4">
        <div className="flex items-center gap-2.5 p-3 bg-green-50 border border-green-100 text-green-700 text-sm">
          <CheckCircle size={15} strokeWidth={1.5} className="shrink-0" />
          <span>Password set successfully. Redirecting…</span>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      {/* Heading — changes based on invite vs recovery */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-black tracking-tight">
          {isInvite   ? 'Welcome to Clikaa'    :
           isRecovery ? 'Reset your password'  :
                        'Set your password'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isInvite
            ? 'Please set a secure password to access your workspace.'
            : 'Create a new password to secure your account.'}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 text-red-700 text-sm">
          <AlertCircle size={15} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* New password */}
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-xs font-medium text-zinc-700 tracking-wide uppercase"
          >
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            autoFocus
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="
              w-full h-10 px-0 py-2
              border-0 border-b border-zinc-200
              bg-transparent text-sm text-black placeholder:text-zinc-400
              focus:outline-none focus:border-black
              transition-colors duration-150
            "
          />
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <label
            htmlFor="confirm"
            className="block text-xs font-medium text-zinc-700 tracking-wide uppercase"
          >
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="
              w-full h-10 px-0 py-2
              border-0 border-b border-zinc-200
              bg-transparent text-sm text-black placeholder:text-zinc-400
              focus:outline-none focus:border-black
              transition-colors duration-150
            "
          />
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="
              w-full h-11 flex items-center justify-center gap-2
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
              isInvite ? 'Set password & enter portal' : 'Set password'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Page (Suspense boundary required for useSearchParams) ────────────────────

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  )
}
