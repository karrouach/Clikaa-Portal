'use client'

import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { LogOut, Loader2, Bell } from 'lucide-react'
import type { Profile } from '@/types/database'
import { signOut } from '@/app/actions'
import { getInitials } from '@/lib/utils'

interface HeaderProps {
  profile: Profile
}

/**
 * Top header bar — displays breadcrumbs and user actions.
 * Client component so we can read the current pathname.
 */
export function Header({ profile }: HeaderProps) {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const initials = getInitials(profile.full_name || profile.email)

  // ── Build breadcrumb segments from the current path ─────────────────────
  const breadcrumbs = buildBreadcrumbs(pathname)

  function handleSignOut() {
    startTransition(async () => {
      await signOut()
    })
  }

  return (
    <header className="hidden md:flex h-14 border-b border-zinc-100 bg-white items-center justify-between px-6 shrink-0">
      {/* Left: Breadcrumbs */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-sm">
          {breadcrumbs.map((crumb, i) => (
            <li key={crumb.label} className="flex items-center gap-2">
              {i > 0 && <span className="text-zinc-300">/</span>}
              <span
                className={
                  i === breadcrumbs.length - 1
                    ? 'text-black font-medium'
                    : 'text-zinc-400'
                }
              >
                {crumb.label}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Notification bell — placeholder for Phase 4 */}
        <button
          className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-black hover:bg-zinc-50 transition-colors rounded-sm"
          aria-label="Notifications"
        >
          <Bell size={16} strokeWidth={1.5} />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-zinc-100" />

        {/* User badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-black flex items-center justify-center text-white text-[10px] font-semibold rounded-sm">
            {initials}
          </div>
          <span className="text-xs text-zinc-500 hidden sm:block">
            {profile.email}
          </span>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={isPending}
          className="
            flex items-center gap-1.5 px-3 h-7 text-xs text-zinc-500
            hover:text-black hover:bg-zinc-50
            border border-transparent hover:border-zinc-200
            transition-all duration-150 rounded-sm
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          aria-label="Sign out"
        >
          {isPending ? (
            <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
          ) : (
            <LogOut size={13} strokeWidth={1.5} />
          )}
          <span className="hidden sm:block">Sign out</span>
        </button>
      </div>
    </header>
  )
}

// ─── Breadcrumb builder ────────────────────────────────────────────────────
type Breadcrumb = { label: string; href?: string }

function buildBreadcrumbs(pathname: string): Breadcrumb[] {
  const segments = pathname.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean)

  const crumbs: Breadcrumb[] = [{ label: 'Dashboard', href: '/dashboard' }]

  // Map known segment patterns to readable labels.
  segments.forEach((segment, i) => {
    const isLast = i === segments.length - 1

    // UUID-looking segments are workspace/task IDs — show placeholder until
    // Phase 3 passes workspace name from the page component.
    const isId = /^[0-9a-f-]{36}$/i.test(segment)

    crumbs.push({
      label: isId ? '…' : capitalize(segment.replace(/-/g, ' ')),
      href: isLast ? undefined : `/dashboard/${segments.slice(0, i + 1).join('/')}`,
    })
  })

  return crumbs
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
