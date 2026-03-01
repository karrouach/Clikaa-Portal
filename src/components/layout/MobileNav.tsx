'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu,
  LayoutDashboard,
  Receipt,
  Users,
  CalendarDays,
  Settings,
  LogOut,
  Loader2,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
import type { Profile, WorkspaceWithRole } from '@/types/database'
import { cn, getInitials } from '@/lib/utils'
import { signOut } from '@/app/actions'

interface Props {
  profile: Profile
  workspaces: WorkspaceWithRole[]
}

// ─── MobileNav ─────────────────────────────────────────────────────────────
// Fixed top bar visible only on mobile (md:hidden).
// Hamburger opens a Sheet drawer from the right that mirrors the desktop Sidebar.
export function MobileNav({ profile, workspaces }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const pathname = usePathname()
  const isAdmin  = profile.role === 'admin'
  const initials = getInitials(profile.full_name || profile.email)

  function handleSignOut() {
    startTransition(async () => {
      await signOut()
    })
  }

  function close() { setOpen(false) }

  // ── Shared link class helper ─────────────────────────────────────────────
  function navClass(active: boolean) {
    return cn(
      'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors rounded-lg',
      active
        ? 'bg-white/15 text-white'
        : 'text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200'
    )
  }

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* ── Fixed top bar — mobile only ──────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 h-14 z-40 md:hidden bg-[#111111] border-b border-white/5 flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img
            src="/logo.svg"
            alt="Clikaa"
            className="h-5 w-auto brightness-0 invert"
            draggable={false}
          />
          <span className="text-[10px] tracking-widest text-zinc-500 uppercase">Portal</span>
        </Link>

        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
        >
          <Menu size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* ── Slide-out drawer ─────────────────────────────────────────────── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className={cn(
            // Override Sheet defaults for dark sidebar aesthetic
            'w-72 bg-[#111111] border-l border-white/5 shadow-none p-0',
            // Style the built-in radix close button for dark bg
            '[&>button]:text-zinc-500 [&>button]:hover:text-white',
          )}
        >
          {/* Header */}
          <div className="flex items-center h-14 px-4 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2">
              <img
                src="/logo.svg"
                alt="Clikaa"
                className="h-5 w-auto brightness-0 invert"
                draggable={false}
              />
              <span className="text-[10px] tracking-widest text-zinc-500 uppercase">Portal</span>
            </div>
          </div>

          {/* User profile */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5 shrink-0">
            <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={initials}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/15 flex items-center justify-center text-white text-xs font-semibold">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white font-medium truncate">
                {profile.full_name || 'No name set'}
              </p>
              <p className="text-xs text-zinc-500 capitalize">{profile.role}</p>
            </div>
          </div>

          {/* Nav links */}
          <div className="flex-1 overflow-y-auto py-3 space-y-4">
            {isAdmin ? (
              <>
                {/* Global section */}
                <div>
                  <p className="px-4 mb-1 text-[10px] uppercase tracking-widest text-zinc-600">
                    Global
                  </p>
                  <Link href="/dashboard" onClick={close}
                    className={navClass(isActive('/dashboard', true))}>
                    <LayoutDashboard size={16} strokeWidth={1.5} />
                    Dashboard
                  </Link>
                  <Link href="/dashboard/invoices" onClick={close}
                    className={navClass(isActive('/dashboard/invoices'))}>
                    <Receipt size={16} strokeWidth={1.5} />
                    Invoices
                  </Link>
                  <Link href="/dashboard/team" onClick={close}
                    className={navClass(isActive('/dashboard/team'))}>
                    <Users size={16} strokeWidth={1.5} />
                    My Team
                  </Link>
                  <Link href="/dashboard/calendar" onClick={close}
                    className={navClass(isActive('/dashboard/calendar'))}>
                    <CalendarDays size={16} strokeWidth={1.5} />
                    Calendar
                  </Link>
                </div>

                {/* Workspaces section */}
                {workspaces.length > 0 && (
                  <div>
                    <p className="px-4 mb-1 text-[10px] uppercase tracking-widest text-zinc-600">
                      Workspaces
                    </p>
                    {workspaces.map((ws) => {
                      const active = pathname.startsWith(`/dashboard/${ws.id}`)
                      return (
                        <Link
                          key={ws.id}
                          href={`/dashboard/${ws.id}`}
                          onClick={close}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-2 rounded-lg',
                            active
                              ? 'bg-white/15 text-white border-white'
                              : 'text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 border-transparent'
                          )}
                        >
                          <span className="shrink-0 w-6 h-6 flex items-center justify-center text-xs font-semibold bg-white/10 rounded-sm">
                            {ws.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate">{ws.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Dashboard — client */}
                <Link href="/dashboard" onClick={close}
                  className={navClass(isActive('/dashboard', true))}>
                  <LayoutDashboard size={16} strokeWidth={1.5} />
                  Dashboard
                </Link>

                {/* Workspaces — client */}
                {workspaces.length > 0 && (
                  <div>
                    <p className="px-4 mb-1 text-[10px] uppercase tracking-widest text-zinc-600">
                      Workspaces
                    </p>
                    {workspaces.map((ws) => {
                      const active = pathname.startsWith(`/dashboard/${ws.id}`)
                      return (
                        <Link
                          key={ws.id}
                          href={`/dashboard/${ws.id}`}
                          onClick={close}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-2 rounded-lg',
                            active
                              ? 'bg-white/15 text-white border-white'
                              : 'text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 border-transparent'
                          )}
                        >
                          <span className="shrink-0 w-6 h-6 flex items-center justify-center text-xs font-semibold bg-white/10 rounded-sm">
                            {ws.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate">{ws.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bottom: Settings + Sign out */}
          <div className="border-t border-white/5 pt-3 pb-safe pb-4 shrink-0">
            <Link href="/dashboard/settings" onClick={close}
              className={navClass(isActive('/dashboard/settings'))}>
              <Settings size={16} strokeWidth={1.5} />
              Settings
            </Link>

            <button
              onClick={handleSignOut}
              disabled={isPending}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              {isPending
                ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                : <LogOut  size={16} strokeWidth={1.5} />
              }
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
