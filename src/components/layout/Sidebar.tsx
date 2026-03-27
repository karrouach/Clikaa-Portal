'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createBrowserClient } from '@supabase/ssr'
import {
  ChevronLeft,
  LayoutDashboard,
  Receipt,
  BookUser,
  CalendarDays,
  Settings,
  HelpCircle,
  FileSignature,
  MessageSquare,
  Wallet,
  ClipboardList,
} from 'lucide-react'
import type { Profile, WorkspaceWithRole } from '@/types/database'
import { cn, getInitials } from '@/lib/utils'

interface SidebarProps {
  profile: Profile
  workspaces: WorkspaceWithRole[]
  unreadMessageCount?: number
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
  badge,
}: {
  href: string
  icon: React.ElementType
  label: string
  isCollapsed: boolean
  exact?: boolean
  badge?: number
}) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      className={cn(
        'flex items-center gap-3 py-2.5 text-sm transition-all duration-150 group relative rounded-lg',
        isCollapsed ? 'px-0 justify-center' : 'px-3',
        isActive
          ? 'bg-white/15 text-white'
          : 'text-zinc-400 hover:bg-white/8 hover:text-zinc-200'
      )}
    >
      {/* Icon with optional unread dot */}
      <span className="relative shrink-0">
        <Icon size={16} strokeWidth={1.5} />
        {isCollapsed && badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#111111]" />
        )}
      </span>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.span
            key="label"
            variants={textVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="overflow-hidden whitespace-nowrap flex-1"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Badge count when expanded */}
      {!isCollapsed && badge != null && badge > 0 && (
        <span className="shrink-0 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}

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
        'flex items-center gap-3 py-2.5 text-sm transition-all duration-150 group relative rounded-lg',
        isCollapsed ? 'px-0 justify-center' : 'px-3 border-l-2',
        isActive
          ? ['bg-white/15 text-white', !isCollapsed && 'border-white']
          : ['text-zinc-400 hover:bg-white/8 hover:text-zinc-200', !isCollapsed && 'border-transparent']
      )}
    >
      {workspace.logo_url ? (
        <img
          src={workspace.logo_url}
          alt={workspace.name}
          className="shrink-0 w-6 h-6 rounded-sm object-cover"
        />
      ) : (
        <span
          className={cn(
            'shrink-0 w-6 h-6 flex items-center justify-center text-xs font-semibold bg-white/10 rounded-sm',
            isActive && 'bg-white/25'
          )}
        >
          {initial}
        </span>
      )}

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
export function Sidebar({ profile, workspaces, unreadMessageCount = 0 }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [msgBadge, setMsgBadge] = useState(unreadMessageCount)
  const pathname  = usePathname()
  const initials  = getInitials(profile.full_name || profile.email)
  const isAdmin    = profile.role === 'admin'
  const isDesigner = profile.role === 'designer'

  // ── Clear badge when the user is on the messages page ─────────────────────
  useEffect(() => {
    if (pathname === '/dashboard/messages') {
      setMsgBadge(0)
    }
  }, [pathname])

  // ── Realtime: increment badge on new incoming messages ────────────────────
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const channel = supabase
      .channel('sidebar:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('Sidebar Realtime Message:', payload)
          const msg = payload.new as { sender_id: string; conversation_id: string }
          // Ignore messages the current user sent
          if (msg.sender_id === profile.id) return
          // Only increment if the user is not already reading messages
          if (window.location.pathname === '/dashboard/messages') return
          setMsgBadge((prev) => prev + 1)
        }
      )
      .subscribe((status) => {
        console.log('Sidebar Realtime Status:', status)
      })

    return () => { supabase.removeChannel(channel) }
  }, [profile.id])

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
              className="overflow-hidden"
            >
              <img
                src="/logo.svg"
                alt="Clikaa Portal"
                className="h-5 w-auto"
                draggable={false}
              />
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
      <div className={cn('flex-1 py-3 space-y-4', isCollapsed ? 'overflow-hidden' : 'overflow-y-auto')}>

        {isAdmin ? (
          <>
            {/* GLOBAL section — admin */}
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
                  href="/dashboard/messages"
                  icon={MessageSquare}
                  label="Messages"
                  isCollapsed={isCollapsed}
                  badge={msgBadge}
                />
                <NavLink
                  href="/dashboard/calendar"
                  icon={CalendarDays}
                  label="Calendar"
                  isCollapsed={isCollapsed}
                />
                <NavLink
                  href="/dashboard/directory"
                  icon={BookUser}
                  label="Directory"
                  isCollapsed={isCollapsed}
                />
                <NavLink
                  href="/dashboard/invoices"
                  icon={Receipt}
                  label="Invoices"
                  isCollapsed={isCollapsed}
                />
                <NavLink
                  href="/dashboard/contracts"
                  icon={FileSignature}
                  label="Contracts"
                  isCollapsed={isCollapsed}
                />
                <NavLink
                  href="/dashboard/designer-invoices"
                  icon={Wallet}
                  label="Payments"
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
        ) : isDesigner ? (
          <>
            {/* Dashboard — designer */}
            <div className="px-3 space-y-0.5">
              <NavLink
                href="/dashboard"
                icon={LayoutDashboard}
                label="Dashboard"
                isCollapsed={isCollapsed}
                exact
              />
              <NavLink
                href="/dashboard/messages"
                icon={MessageSquare}
                label="Messages"
                isCollapsed={isCollapsed}
                badge={msgBadge}
              />
              <NavLink
                href="/dashboard/my-tasks"
                icon={ClipboardList}
                label="My Tasks"
                isCollapsed={isCollapsed}
              />
              <NavLink
                href="/dashboard/contracts"
                icon={FileSignature}
                label="Contracts"
                isCollapsed={isCollapsed}
              />
              <NavLink
                href="/dashboard/designer-invoices"
                icon={Wallet}
                label="Payments"
                isCollapsed={isCollapsed}
              />
            </div>

            {/* Workspaces — designer */}
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
            <div className="px-3 space-y-0.5">
              <NavLink
                href="/dashboard"
                icon={LayoutDashboard}
                label="Dashboard"
                isCollapsed={isCollapsed}
                exact
              />
              <NavLink
                href="/dashboard/messages"
                icon={MessageSquare}
                label="Messages"
                isCollapsed={isCollapsed}
                badge={msgBadge}
              />
              <NavLink
                href="/dashboard/invoices"
                icon={Receipt}
                label="Invoices"
                isCollapsed={isCollapsed}
              />
              <NavLink
                href="/dashboard/contracts"
                icon={FileSignature}
                label="Contracts"
                isCollapsed={isCollapsed}
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

      {/* ── Bottom: Help (client + designer) + Settings ───────────────────── */}
      <div className="px-3 pb-4 border-t border-white/5 pt-3 space-y-0.5">
        {!isAdmin && (
          <NavLink
            href="/dashboard/support"
            icon={HelpCircle}
            label="Help & Support"
            isCollapsed={isCollapsed}
          />
        )}
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
