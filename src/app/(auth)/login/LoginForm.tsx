'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import { signIn, type LoginState } from './actions'

// ─── Submit button with pending state via useFormStatus ──────────────────────
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        w-full h-11 flex items-center justify-center gap-2
        bg-black text-white text-sm font-medium tracking-wide
        hover:bg-zinc-800 active:bg-zinc-900
        transition-colors duration-150
        disabled:opacity-60 disabled:cursor-not-allowed
      "
    >
      {pending ? (
        <>
          <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
          Signing in…
        </>
      ) : (
        <>
          Sign In
          <ArrowRight size={14} strokeWidth={1.5} />
        </>
      )}
    </button>
  )
}

// ─── Login form — must live in its own component to allow Suspense wrapping ──
export function LoginForm() {
  const [state, formAction] = useActionState<LoginState | null, FormData>(signIn, null)
  const searchParams = useSearchParams()

  const callbackError = searchParams.get('error')

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Sign in to access your client workspace.
        </p>
      </div>

      {/* Error banner */}
      {(state?.error || callbackError) && (
        <div className="mb-6 flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 text-red-700 text-sm">
          <AlertCircle size={15} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <span>
            {state?.error ??
              'Authentication failed. Please try signing in again.'}
          </span>
        </div>
      )}

      {/* Form */}
      <form action={formAction} className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-medium text-zinc-700 tracking-wide uppercase">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            className="
              w-full h-10 px-0 py-2
              border-0 border-b border-zinc-200
              bg-transparent text-sm text-black placeholder:text-zinc-400
              focus:outline-none focus:border-black
              transition-colors duration-150
            "
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-xs font-medium text-zinc-700 tracking-wide uppercase">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
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
          <SubmitButton />
        </div>
      </form>

      {/* Footer note */}
      <p className="mt-6 text-xs text-zinc-400 text-center">
        Don&apos;t have access?{' '}
        <a
          href="mailto:hello@clikaa.com"
          className="text-black underline underline-offset-2 hover:no-underline"
        >
          Contact Clikaa
        </a>
        .
      </p>
    </motion.div>
  )
}
