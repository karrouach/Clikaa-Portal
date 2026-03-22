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

export function MobileNav({ profile, workspaces }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const pathname = usePathname()
  const isAdmin  = profile.role === 'admin'
  const initials = getInitials(profile.full_name || profile.email)

  function handleSignOut() {
    startTransition(async () => { await signOut() })
  }

  function close() { setOpen(false) }

  function navClass(active: boolean) {
    return cn(
      'flex items-center gap-3 px-4 py-3 text-sm transition-colors rounded-lg',
      active
        ? 'bg-white/[0.08] text-white'
        : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
    )
  }

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* ── Fixed top bar — mobile only ────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 h-14 z-40 md:hidden bg-[#111111] border-b border-white/5 flex items-center justify-between px-4">
        <Link href="/dashboard">
          <img
            src="/logo.svg"
            alt="Clikaa Portal"
            className="h-5 w-auto"
            draggable={false}
          />
        </Link>

        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
        >
          <Menu size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* ── Slide-out drawer ───────────────────────────────────────────────── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className={cn(
            'w-72 border-l border-white/8 shadow-none p-0',
            'bg-black/85 backdrop-blur-xl',
            '[&>button]:text-zinc-500 [&>button]:hover:text-white',
          )}
        >
          {/* ── Drawer header — logo only, no duplicate text ──────────────── */}
          <div className="flex items-center h-14 px-5 shrink-0">
            <img
              src="/logo.svg"
              alt="Clikaa Portal"
              className="h-5 w-auto"
              draggable={false}
            />
          </div>

          {/* ── User profile ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-5 py-4 shrink-0">
            <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={initials} className="w-full h-full object-cover" />
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

          {/* ── Nav links ─────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto py-2 space-y-5">
            {isAdmin ? (
              <>
                {/* Global section */}
                <div>
                  <p className="px-5 mb-2 text-[10px] uppercase tracking-widest text-zinc-600">
                    Global
                  </p>
                  <div className="px-2 space-y-0.5">
                    <Link href="/dashboard" onClick={close} className={navClass(isActive('/dashboard', true))}>
                      <LayoutDashboard size={16} strokeWidth={1.5} className="shrink-0" />
                      Dashboard
                    </Link>
                    <Link href="/dashboard/invoices" onClick={close} className={navClass(isActive('/dashboard/invoices'))}>
                      <Receipt size={16} strokeWidth={1.5} className="shrink-0" />
                      Invoices
                    </Link>
                    <Link href="/dashboard/team" onClick={close} className={navClass(isActive('/dashboard/team'))}>
                      <Users size={16} strokeWidth={1.5} className="shrink-0" />
                      My Team
                    </Link>
                    <Link href="/dashboard/calendar" onClick={close} className={navClass(isActive('/dashboard/calendar'))}>
                      <CalendarDays size={16} strokeWidth={1.5} className="shrink-0" />
                      Calendar
                    </Link>
                  </div>
                </div>

                {/* Workspaces section */}
                {workspaces.length > 0 && (
                  <div>
                    <p className="px-5 mb-2 text-[10px] uppercase tracking-widest text-zinc-600">
                      Workspaces
                    </p>
                    <div className="px-2 space-y-0.5">
                      {workspaces.map((ws) => {
                        const active = pathname.startsWith(`/dashboard/${ws.id}`)
                        return (
                          <Link
                            key={ws.id}
                            href={`/dashboard/${ws.id}`}
                            onClick={close}
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 text-sm transition-colors rounded-lg',
                              active
                                ? 'bg-white/[0.08] text-white'
                                : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                            )}
                          >
                            <span className="shrink-0 w-5 h-5 flex items-center justify-center text-xs font-semibold bg-white/10 rounded-sm">
                              {ws.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="truncate">{ws.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Dashboard — client */}
                <div className="px-2">
                  <Link href="/dashboard" onClick={close} className={navClass(isActive('/dashboard', true))}>
                    <LayoutDashboard size={16} strokeWidth={1.5} className="shrink-0" />
                    Dashboard
                  </Link>
                </div>

                {/* Workspaces — client */}
                {workspaces.length > 0 && (
                  <div>
                    <p className="px-5 mb-2 text-[10px] uppercase tracking-widest text-zinc-600">
                      Workspaces
                    </p>
                    <div className="px-2 space-y-0.5">
                      {workspaces.map((ws) => {
                        const active = pathname.startsWith(`/dashboard/${ws.id}`)
                        return (
                          <Link
                            key={ws.id}
                            href={`/dashboard/${ws.id}`}
                            onClick={close}
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 text-sm transition-colors rounded-lg',
                              active
                                ? 'bg-white/[0.08] text-white'
                                : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                            )}
                          >
                            <span className="shrink-0 w-5 h-5 flex items-center justify-center text-xs font-semibold bg-white/10 rounded-sm">
                              {ws.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="truncate">{ws.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Bottom: Settings + Sign out — no divider, whitespace only ─── */}
          <div className="pt-4 pb-8 px-2 shrink-0 space-y-0.5">
            <Link href="/dashboard/settings" onClick={close} className={navClass(isActive('/dashboard/settings'))}>
              <Settings size={16} strokeWidth={1.5} className="shrink-0" />
              Settings
            </Link>

            <button
              onClick={handleSignOut}
              disabled={isPending}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-colors',
                'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200',
                'disabled:opacity-50'
              )}
            >
              {isPending
                ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin shrink-0" />
                : <LogOut  size={16} strokeWidth={1.5} className="shrink-0" />
              }
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
