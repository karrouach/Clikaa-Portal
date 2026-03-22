'use client'

import Link from 'next/link'

export function MobileNav() {
  return (
    /* ── Fixed top bar — mobile only ─────────────────────────────────────── */
    <div className="fixed top-0 left-0 right-0 h-14 z-40 md:hidden bg-[#111111] border-b border-white/5 flex items-center px-4">
      <Link href="/dashboard">
        <img
          src="/logo.svg"
          alt="Clikaa Portal"
          className="h-5 w-auto"
          draggable={false}
        />
      </Link>
    </div>
  )
}
