'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import type { Profile, WorkspaceWithRole } from '@/types/database'
import { signOut } from '@/app/actions'
import { getInitials } from '@/lib/utils'
import { NotificationBell } from './NotificationBell'
import { CommandMenu } from './CommandMenu'

interface HeaderProps {
  profile: Profile
  workspaces: WorkspaceWithRole[]
}

// Human-readable labels for known route segments
const SEGMENT_LABELS: Record<string, string> = {
  strategy:  'Strategy',
  files:     'Files',
  details:   'Details',
  settings:  'Settings',
  invoices:  'Invoices',
  team:      'Team',
  directory: 'Directory',
  calendar:  'Calendar',
  support:   'Support',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Top header bar — displays breadcrumbs and user actions.
 * Client component so we can read the current pathname.
 */
export function Header({ profile, workspaces }: HeaderProps) {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const initials = getInitials(profile.full_name || profile.email)

  const breadcrumbs = buildBreadcrumbs(pathname, workspaces)

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
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1
            return (
              <li key={i} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="text-zinc-300 font-light select-none">/</span>
                )}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="text-[#6B7280] font-medium hover:text-zinc-900 transition-colors duration-150"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? 'text-black font-semibold' : 'text-[#6B7280] font-medium'}>
                    {crumb.label}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Command palette search */}
        <CommandMenu isAdmin={profile.role === 'admin'} workspaces={workspaces} />

        {/* Divider */}
        <div className="w-px h-5 bg-zinc-100" />

        {/* Notification bell */}
        <NotificationBell userId={profile.id} />

        {/* Divider */}
        <div className="w-px h-5 bg-zinc-100" />

        {/* User badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-black flex items-center justify-center text-white text-[10px] font-semibold rounded-lg">
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
            transition-all duration-150 rounded-lg
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

function buildBreadcrumbs(pathname: string, workspaces: WorkspaceWithRole[]): Breadcrumb[] {
  const segments = pathname.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean)

  // Root dashboard
  if (segments.length === 0) {
    return [{ label: 'Dashboard' }]
  }

  const [first, ...rest] = segments

  // Workspace context — first segment is a UUID
  if (UUID_RE.test(first)) {
    const workspace = workspaces.find((w) => w.id === first)
    const wsLabel   = workspace?.name ?? '…'
    const tabSegment = rest[0] ?? null
    const tabLabel   = tabSegment
      ? (SEGMENT_LABELS[tabSegment] ?? capitalize(tabSegment.replace(/-/g, ' ')))
      : 'Board'

    return [
      { label: wsLabel, href: `/dashboard/${first}` },
      { label: tabLabel },
    ]
  }

  // Top-level dashboard sub-pages (invoices, team, calendar, settings…)
  return [
    { label: 'Dashboard', href: '/dashboard' },
    { label: SEGMENT_LABELS[first] ?? capitalize(first.replace(/-/g, ' ')) },
  ]
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
