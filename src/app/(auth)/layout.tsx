import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
}

/**
 * Auth layout — full-screen centered container.
 * Shared by /login and /accept-invite.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      {/* Wordmark */}
      <div className="mb-12">
        <span className="text-xl font-semibold tracking-tight text-black">CLIKAA</span>
        <span className="ml-1.5 text-xs tracking-widest text-zinc-400 uppercase">Portal</span>
      </div>

      {/* Page content (login card or accept-invite card) */}
      <div className="w-full max-w-sm">{children}</div>

      {/* Footer */}
      <p className="mt-16 text-xs text-zinc-400">
        © {new Date().getFullYear()} Clikaa. All rights reserved.
      </p>
    </div>
  )
}
