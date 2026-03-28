'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ClipboardList, Building2, Users, Loader2 } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { createClient } from '@/lib/supabase/client'
import { cn, getInitials } from '@/lib/utils'
import type { WorkspaceWithRole } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskResult    = { type: 'task';      id: string; title: string; status: string; workspace_id: string; workspaceName: string }
type WorkspaceResult = { type: 'workspace'; id: string; name: string; description: string | null }
type MemberResult  = { type: 'member';    id: string; name: string; email: string; role: string; avatar_url: string | null }
type SearchResult  = TaskResult | WorkspaceResult | MemberResult

type FilterType = 'all' | 'workspaces' | 'tasks' | 'team'

// ─── Status chip colours ──────────────────────────────────────────────────────

const STATUS_CHIP: Record<string, string> = {
  todo:        'bg-zinc-100 text-zinc-500',
  pending:     'bg-amber-50 text-amber-700',
  in_progress: 'bg-blue-50 text-blue-700',
  review:      'bg-violet-50 text-violet-700',
  done:        'bg-emerald-50 text-emerald-700',
}

const ROLE_CHIP: Record<string, string> = {
  admin:    'bg-zinc-900 text-white',
  designer: 'bg-violet-100 text-violet-700',
  client:   'bg-zinc-100 text-zinc-500',
}

// ─── CommandMenu ──────────────────────────────────────────────────────────────

interface CommandMenuProps {
  isAdmin: boolean
  workspaces: WorkspaceWithRole[]
}

export function CommandMenu({ isAdmin, workspaces }: CommandMenuProps) {
  const [open, setOpen]                 = useState(false)
  const [query, setQuery]               = useState('')
  const [filter, setFilter]             = useState<FilterType>('all')
  const [tasks, setTasks]               = useState<TaskResult[]>([])
  const [members, setMembers]           = useState<MemberResult[]>([])
  const [loading, setLoading]           = useState(false)
  const [activeIndex, setActiveIndex]   = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  // ── Global keyboard shortcut ─────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── Fetch data when menu opens ───────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setLoading(true)
    const supabase = createClient()

    const fetchTasks = supabase
      .from('tasks')
      .select('id, title, status, workspace_id, workspaces(name)')
      .neq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setTasks(
          (data ?? []).map((t) => ({
            type:          'task' as const,
            id:            t.id,
            title:         t.title,
            status:        t.status,
            workspace_id:  t.workspace_id,
            workspaceName: (t.workspaces as { name: string } | null)?.name ?? '',
          }))
        )
      })

    // Admin: also fetch team members
    const fetchMembers = isAdmin
      ? supabase
          .from('profiles')
          .select('id, full_name, email, role, avatar_url')
          .in('role', ['admin', 'designer'])
          .order('full_name', { ascending: true })
          .then(({ data }) => {
            setMembers(
              (data ?? []).map((p) => ({
                type:      'member' as const,
                id:        p.id,
                name:      p.full_name || p.email,
                email:     p.email,
                role:      p.role,
                avatar_url: p.avatar_url,
              }))
            )
          })
      : Promise.resolve()

    Promise.all([fetchTasks, fetchMembers]).then(() => setLoading(false))
  }, [open, isAdmin])

  // ── Build filtered results ───────────────────────────────────────────────
  const q = query.trim().toLowerCase()

  const filteredTasks: SearchResult[] = tasks.filter(
    (t) => !q || t.title.toLowerCase().includes(q) || t.workspaceName.toLowerCase().includes(q)
  )

  const filteredWorkspaces: SearchResult[] = workspaces
    .filter((w) => !q || w.name.toLowerCase().includes(q) || (w.description ?? '').toLowerCase().includes(q))
    .map((w) => ({ type: 'workspace' as const, id: w.id, name: w.name, description: w.description }))

  const filteredMembers: SearchResult[] = members.filter(
    (m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  )

  let filtered: SearchResult[]
  if (!isAdmin) {
    // Clients: tasks only
    filtered = filteredTasks.slice(0, 8)
  } else if (filter === 'tasks') {
    filtered = filteredTasks.slice(0, 8)
  } else if (filter === 'workspaces') {
    filtered = filteredWorkspaces.slice(0, 8)
  } else if (filter === 'team') {
    filtered = filteredMembers.slice(0, 8)
  } else {
    // 'all': mix results
    filtered = [
      ...filteredTasks.slice(0, q ? 4 : 3),
      ...filteredWorkspaces.slice(0, q ? 2 : 3),
      ...filteredMembers.slice(0, q ? 2 : 2),
    ].slice(0, 8)
  }

  useEffect(() => { setActiveIndex(0) }, [query, filter])

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleClose() {
    setOpen(false)
    setQuery('')
    setFilter('all')
  }

  function handleSelect(result: SearchResult) {
    if (result.type === 'task')      router.push(`/dashboard/${result.workspace_id}`)
    if (result.type === 'workspace') router.push(`/dashboard/${result.id}`)
    if (result.type === 'member')    router.push(`/dashboard/team/${result.id}`)
    handleClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      handleSelect(filtered[activeIndex])
    }
  }

  // ── Admin filter chips ────────────────────────────────────────────────────
  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all',        label: 'All' },
    { key: 'tasks',      label: 'Tasks' },
    { key: 'workspaces', label: 'Workspaces' },
    { key: 'team',       label: 'Team' },
  ]

  return (
    <>
      {/* ── Trigger button ─────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Search (⌘K)"
        className="
          flex items-center gap-2 h-7 px-3
          text-xs text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700 rounded-lg
          hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300
          transition-colors duration-150
        "
      >
        <Search size={12} strokeWidth={1.5} />
        <span className="hidden sm:block">Search…</span>
        <kbd className="hidden sm:block ml-1 text-[10px] text-zinc-300 font-mono">⌘K</kbd>
      </button>

      {/* ── Dialog ─────────────────────────────────────────────────────── */}
      <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="
              fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]
              data-[state=open]:animate-overlay-show
              data-[state=closed]:animate-overlay-hide
            "
          />
          <DialogPrimitive.Content
            onKeyDown={handleKeyDown}
            className="
              fixed left-1/2 top-[18vh] z-50 -translate-x-1/2
              w-full max-w-lg
              bg-white dark:bg-[#1A1A1A] shadow-2xl shadow-black/10 dark:shadow-black/60 rounded-xl overflow-hidden
              data-[state=open]:animate-dialog-show
              data-[state=closed]:animate-dialog-hide
            "
          >
            <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Search tasks, workspaces, and team members.
            </DialogPrimitive.Description>

            {/* Search bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <Search size={15} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isAdmin ? 'Search tasks, workspaces, team…' : 'Search tasks…'}
                className="flex-1 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 bg-transparent outline-none"
              />
              {loading && <Loader2 size={13} strokeWidth={1.5} className="animate-spin text-zinc-300 shrink-0" />}
              <kbd className="hidden sm:block text-[10px] text-zinc-300 dark:text-zinc-600 font-mono border border-zinc-100 dark:border-zinc-700 rounded px-1.5 py-0.5">esc</kbd>
            </div>

            {/* Admin filter chips */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
                {FILTERS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      'px-3 h-6 text-[11px] font-medium rounded-full transition-colors duration-100',
                      filter === key
                        ? 'bg-black dark:bg-white text-white dark:text-black'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Results */}
            <div className="max-h-[340px] overflow-y-auto py-1">
              {!loading && filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <ClipboardList size={20} strokeWidth={1.5} className="text-zinc-200 mb-2" />
                  <p className="text-xs text-zinc-400">
                    {query ? 'No results match your search' : 'No results found'}
                  </p>
                </div>
              ) : (
                filtered.map((result, i) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors duration-75',
                      i === activeIndex ? 'bg-zinc-50 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    )}
                  >
                    {result.type === 'task' && (
                      <>
                        <ClipboardList size={14} strokeWidth={1.5} className="text-zinc-300 dark:text-zinc-600 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-900 dark:text-white truncate">{result.title}</p>
                          {result.workspaceName && (
                            <p className="text-[11px] text-zinc-400 mt-0.5">{result.workspaceName}</p>
                          )}
                        </div>
                        <span className={cn('ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded capitalize', STATUS_CHIP[result.status] ?? 'bg-zinc-100 text-zinc-500')}>
                          {result.status.replace('_', ' ')}
                        </span>
                      </>
                    )}

                    {result.type === 'workspace' && (
                      <>
                        <Building2 size={14} strokeWidth={1.5} className="text-zinc-300 dark:text-zinc-600 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-900 dark:text-white truncate">{result.name}</p>
                          {result.description && (
                            <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{result.description}</p>
                          )}
                        </div>
                        <span className="ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                          workspace
                        </span>
                      </>
                    )}

                    {result.type === 'member' && (
                      <>
                        {result.avatar_url ? (
                          <img src={result.avatar_url} alt="" className="shrink-0 w-5 h-5 rounded-full object-cover mt-0.5" />
                        ) : (
                          <div className="shrink-0 w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mt-0.5">
                            <span className="text-[8px] font-semibold text-zinc-500 dark:text-zinc-300">{getInitials(result.name)}</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-900 dark:text-white truncate">{result.name}</p>
                          <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{result.email}</p>
                        </div>
                        <span className={cn('ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded capitalize', ROLE_CHIP[result.role] ?? 'bg-zinc-100 text-zinc-500')}>
                          {result.role}
                        </span>
                      </>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer hints */}
            <div className="px-4 py-2 border-t border-zinc-50 dark:border-zinc-800 flex items-center gap-4">
              {[
                { key: '↑↓',  label: 'navigate' },
                { key: '↵',   label: 'open' },
                { key: 'esc', label: 'close' },
              ].map(({ key, label }) => (
                <span key={key} className="text-[10px] text-zinc-300 flex items-center gap-1 font-mono">
                  <kbd>{key}</kbd>
                  <span className="font-sans">{label}</span>
                </span>
              ))}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
