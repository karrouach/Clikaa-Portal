'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { setPassword, type AcceptInviteState } from './actions'

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
          Saving…
        </>
      ) : (
        <>
          Activate account
          <ArrowRight size={14} strokeWidth={1.5} />
        </>
      )}
    </button>
  )
}

interface Props {
  initialFullName: string
  email: string
}

export default function AcceptInviteForm({ initialFullName, email }: Props) {
  const [state, formAction] = useActionState<AcceptInviteState | null, FormData>(
    setPassword,
    null
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Heading */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={18} strokeWidth={1.5} className="text-black" />
          <span className="text-xs text-zinc-500 uppercase tracking-widest">Invite accepted</span>
        </div>
        <h1 className="text-2xl font-semibold text-black tracking-tight">Set up your account</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Signed in as <span className="text-black">{email}</span>. Choose a password to get started.
        </p>
      </div>

      {/* Error banner */}
      {state?.error && (
        <div className="mb-6 flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 text-red-700 text-sm">
          <AlertCircle size={15} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <form action={formAction} className="space-y-5">
        {/* Full name */}
        <div className="space-y-1.5">
          <label htmlFor="full_name" className="block text-xs font-medium text-zinc-700 tracking-wide uppercase">
            Full name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            required
            defaultValue={initialFullName}
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

        {/* New password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-xs font-medium text-zinc-700 tracking-wide uppercase">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Minimum 8 characters"
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
          <label htmlFor="confirm_password" className="block text-xs font-medium text-zinc-700 tracking-wide uppercase">
            Confirm password
          </label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
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

        <div className="pt-2">
          <SubmitButton />
        </div>
      </form>
    </motion.div>
  )
}
