'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  LayoutDashboard,
  Receipt,
  Users,
  CalendarDays,
  Settings,
} from 'lucide-react'
import type { Profile, WorkspaceWithRole } from '@/types/database'
import { cn, getInitials } from '@/lib/utils'

interface SidebarProps {
  profile: Profile
  workspaces: WorkspaceWithRole[]
}

// ─── Animation variants ────────────────────────────────────────────────────
const textVariants = {
  visible: { opacity: 1, width: 'auto', transition: { duration: 0.2, delay: 0.05 } },
  hidden:  { opacity: 0, width: 0,      transition: { duration: 0.15 } },
}

const sidebarVariants = {
  expanded:  { width: 248 },
  collapsed: { width: 64 },
}

// ─── Section label ─────────────────────────────────────────────────────────
function SectionLabel({ label, isCollapsed }: { label: string; isCollapsed: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {!isCollapsed && (
        <motion.p
          key={label}
          variants={textVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="px-6 mb-1 text-[10px] uppercase tracking-widest text-zinc-600 overflow-hidden whitespace-nowrap"
        >
          {label}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

// ─── Generic nav link ──────────────────────────────────────────────────────
function NavLink({
  href,
  icon: Icon,
  label,
  isCollapsed,
  exact = false,
}: {
  href: string
  icon: React.ElementType
  label: string
  isCollapsed: boolean
  exact?: boolean
}) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-150 group relative',
        isActive
          ? 'bg-white/15 text-white'
          : 'text-zinc-400 hover:bg-white/8 hover:text-zinc-200'
      )}
    >
      <Icon size={16} strokeWidth={1.5} className="shrink-0" />

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.span
            key="label"
            variants={textVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="overflow-hidden whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      {isCollapsed && (
        <div className="absolute left-full ml-3 px-2 py-1 bg-zinc-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          {label}
        </div>
      )}
    </Link>
  )
}

// ─── Workspace nav item ────────────────────────────────────────────────────
function WorkspaceItem({
  workspace,
  isCollapsed,
}: {
  workspace: WorkspaceWithRole
  isCollapsed: boolean
}) {
  const pathname = usePathname()
  const isActive = pathname.startsWith(`/dashboard/${workspace.id}`)
  const initial = workspace.name.charAt(0).toUpperCase()

  return (
    <Link
      href={`/dashboard/${workspace.id}`}
      title={isCollapsed ? workspace.name : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-150 group relative',
        isActive
          ? 'bg-white/15 text-white border-l-2 border-white'
          : 'text-zinc-400 hover:bg-white/8 hover:text-zinc-200 border-l-2 border-transparent'
      )}
    >
      <span
        className={cn(
          'shrink-0 w-6 h-6 flex items-center justify-center text-xs font-semibold bg-white/10 rounded-sm',
          isActive && 'bg-white/25'
        )}
      >
        {initial}
      </span>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.span
            key="label"
            variants={textVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="overflow-hidden whitespace-nowrap min-w-0 truncate flex-1"
          >
            {workspace.name}
          </motion.span>
        )}
      </AnimatePresence>

      {isCollapsed && (
        <div className="absolute left-full ml-3 px-2 py-1 bg-zinc-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          {workspace.name}
        </div>
      )}
    </Link>
  )
}

// ─── Sidebar ───────────────────────────────────────────────────────────────
export function Sidebar({ profile, workspaces }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const initials = getInitials(profile.full_name || profile.email)
  const isAdmin = profile.role === 'admin'

  return (
    <motion.aside
      variants={sidebarVariants}
      animate={isCollapsed ? 'collapsed' : 'expanded'}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="hidden md:flex relative flex-col bg-[#111111] border-r border-white/5 shrink-0 overflow-hidden"
    >
      {/* ── Top: Brand + collapse toggle ──────────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-white/5">
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key="brand"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden flex items-center gap-2"
            >
              {/* Logo — invert dark paths to white for the dark sidebar */}
              <img
                src="/logo.svg"
                alt="Clikaa"
                className="h-5 w-auto brightness-0 invert"
                draggable={false}
              />
              <span className="text-[10px] tracking-widest text-zinc-500 uppercase whitespace-nowrap">
                Portal
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsCollapsed((c) => !c)}
          className="shrink-0 w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 rounded transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronLeft size={14} strokeWidth={1.5} />
          </motion.div>
        </button>
      </div>

      {/* ── User profile ──────────────────────────────────────────────────── */}
      <div className={cn('flex items-center gap-3 px-4 py-4 border-b border-white/5', isCollapsed && 'justify-center px-2')}>
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

        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key="user-info"
              variants={textVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="overflow-hidden min-w-0"
            >
              <p className="text-sm text-white font-medium truncate whitespace-nowrap">
                {profile.full_name || 'No name set'}
              </p>
              <p className="text-xs text-zinc-500 truncate whitespace-nowrap capitalize">
                {profile.role}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4">

        {isAdmin ? (
          <>
            {/* GLOBAL section — admin only */}
            <div>
              <div className="mb-1">
                <SectionLabel label="Global" isCollapsed={isCollapsed} />
              </div>
              <div className="px-3 space-y-0.5">
                <NavLink
                  href="/dashboard"
                  icon={LayoutDashboard}
                  label="Dashboard"
                  isCollapsed={isCollapsed}
                  exact
                />
                <NavLink
                  href="/dashboard/invoices"
                  icon={Receipt}
                  label="Invoices"
                  isCollapsed={isCollapsed}
                />
                <NavLink
                  href="/dashboard/team"
                  icon={Users}
                  label="My Team"
                  isCollapsed={isCollapsed}
                />
                <NavLink
                  href="/dashboard/calendar"
                  icon={CalendarDays}
                  label="Calendar"
                  isCollapsed={isCollapsed}
                />
              </div>
            </div>

            {/* WORKSPACES section — admin */}
            {workspaces.length > 0 && (
              <div>
                <div className="mb-1">
                  <SectionLabel label="Workspaces" isCollapsed={isCollapsed} />
                </div>
                <div className="px-3 space-y-0.5">
                  {workspaces.map((ws) => (
                    <WorkspaceItem key={ws.id} workspace={ws} isCollapsed={isCollapsed} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Dashboard — client */}
            <div className="px-3">
              <NavLink
                href="/dashboard"
                icon={LayoutDashboard}
                label="Dashboard"
                isCollapsed={isCollapsed}
                exact
              />
            </div>

            {/* Workspaces — client */}
            {workspaces.length > 0 && (
              <div>
                <div className="mb-1">
                  <SectionLabel label="Workspaces" isCollapsed={isCollapsed} />
                </div>
                <div className="px-3 space-y-0.5">
                  {workspaces.map((ws) => (
                    <WorkspaceItem key={ws.id} workspace={ws} isCollapsed={isCollapsed} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Bottom: Settings ──────────────────────────────────────────────── */}
      <div className="px-3 pb-4 border-t border-white/5 pt-3">
        <NavLink
          href="/dashboard/settings"
          icon={Settings}
          label="Settings"
          isCollapsed={isCollapsed}
        />
      </div>
    </motion.aside>
  )
}
