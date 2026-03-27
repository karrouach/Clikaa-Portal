'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition, useState, useRef, useEffect } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import type { Profile, WorkspaceWithRole } from '@/types/database'
import { signOut } from '@/app/actions'
import { getInitials } from '@/lib/utils'
import { NotificationBell } from './NotificationBell'
import { CommandMenu } from './CommandMenu'
import { ThemeToggleCompact } from '@/components/ui/ThemeToggle'

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
  contracts: 'Contracts',
  messages:  'Messages',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Top header bar — displays breadcrumbs and user actions.
 * Client component so we can read the current pathname.
 */
export function Header({ profile, workspaces }: HeaderProps) {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const initials = getInitials(profile.full_name || profile.email)

  const breadcrumbs = buildBreadcrumbs(pathname, workspaces)

  function handleSignOut() {
    startTransition(async () => {
      await signOut()
    })
  }

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <header className="hidden md:flex h-14 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 items-center justify-between px-6 shrink-0">
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
                    className="text-[#6B7280] dark:text-zinc-500 font-medium hover:text-zinc-900 dark:hover:text-white transition-colors duration-150"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? 'text-black dark:text-white font-semibold' : 'text-[#6B7280] dark:text-zinc-500 font-medium'}>
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
        <div className="w-px h-5 bg-zinc-100 dark:bg-zinc-800" />

        {/* Theme toggle */}
        <ThemeToggleCompact />

        {/* Divider */}
        <div className="w-px h-5 bg-zinc-100 dark:bg-zinc-800" />

        {/* Notification bell */}
        <NotificationBell userId={profile.id} />

        {/* Divider */}
        <div className="w-px h-5 bg-zinc-100 dark:bg-zinc-800" />

        {/* Avatar with user popover */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-7 h-7 bg-black flex items-center justify-center text-white text-[10px] font-semibold rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="User menu"
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={initials}
                className="w-full h-full rounded-lg object-cover"
              />
            ) : (
              initials
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-9 w-56 bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-50 overflow-hidden">
              {/* User info */}
              <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-black rounded-lg flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={initials} className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black dark:text-white truncate">
                      {profile.full_name || 'No name set'}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">{profile.email}</p>
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600 capitalize">
                  {profile.role}
                </span>
              </div>

              {/* Actions */}
              <div className="p-1.5">
                <Link
                  href="/dashboard/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors w-full"
                >
                  Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  disabled={isPending}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isPending
                    ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                    : <LogOut size={14} strokeWidth={1.5} />
                  }
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
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

  // Top-level dashboard sub-pages (invoices, messages, calendar, settings…)
  return [
    { label: 'Dashboard', href: '/dashboard' },
    { label: SEGMENT_LABELS[first] ?? capitalize(first.replace(/-/g, ' ')) },
  ]
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
