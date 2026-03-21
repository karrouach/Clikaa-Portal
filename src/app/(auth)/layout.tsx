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
      {/* Logo + page content — left-aligned within the card width */}
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <img src="/logo-light.svg" alt="Clikaa Portal" className="h-7 w-auto" draggable={false} />
        </div>

        {children}
      </div>

      {/* Footer */}
      <p className="mt-16 text-xs text-zinc-400">
        © {new Date().getFullYear()} Clikaa. All rights reserved.
      </p>
    </div>
  )
}
