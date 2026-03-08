'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ClipboardList, Loader2 } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskResult = {
  id: string
  title: string
  status: string
  workspace_id: string
  workspaceName: string
}

// ─── Status chip colours ──────────────────────────────────────────────────────

const STATUS_CHIP: Record<string, string> = {
  todo:        'bg-zinc-100 text-zinc-500',
  pending:     'bg-amber-50 text-amber-700',
  in_progress: 'bg-blue-50 text-blue-700',
  review:      'bg-violet-50 text-violet-700',
  done:        'bg-emerald-50 text-emerald-700',
}

// ─── CommandMenu ──────────────────────────────────────────────────────────────

/**
 * Global command palette triggered by Ctrl+K / Cmd+K.
 * Renders a Search button in the header and a full-screen dialog overlay.
 * No external cmdk dependency — built on the already-installed Radix Dialog.
 */
export function CommandMenu() {
  const [open, setOpen]             = useState(false)
  const [query, setQuery]           = useState('')
  const [tasks, setTasks]           = useState<TaskResult[]>([])
  const [loading, setLoading]       = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  // ── Global keyboard shortcut ────────────────────────────────────────────────
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

  // ── Fetch tasks when menu opens ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setLoading(true)
    const supabase = createClient()
    supabase
      .from('tasks')
      .select('id, title, status, workspace_id, workspaces(name)')
      .neq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setTasks(
          (data ?? []).map((t) => ({
            id:            t.id,
            title:         t.title,
            status:        t.status,
            workspace_id:  t.workspace_id,
            workspaceName: (t.workspaces as { name: string } | null)?.name ?? '',
          }))
        )
        setLoading(false)
      })
  }, [open])

  // ── Filtered results ────────────────────────────────────────────────────────
  const filtered = query.trim()
    ? tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.workspaceName.toLowerCase().includes(query.toLowerCase())
      )
    : tasks.slice(0, 8)

  // Reset active index when query changes
  useEffect(() => { setActiveIndex(0) }, [query])

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleClose() {
    setOpen(false)
    setQuery('')
  }

  function handleSelect(task: TaskResult) {
    router.push(`/dashboard/${task.workspace_id}`)
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Trigger button ──────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Search tasks (⌘K)"
        className="
          flex items-center gap-2 h-7 px-3
          text-xs text-zinc-400 border border-zinc-200 rounded-lg
          hover:border-zinc-300 hover:text-zinc-600
          transition-colors duration-150
        "
      >
        <Search size={12} strokeWidth={1.5} />
        <span className="hidden sm:block">Search…</span>
        <kbd className="hidden sm:block ml-1 text-[10px] text-zinc-300 font-mono">⌘K</kbd>
      </button>

      {/* ── Dialog ──────────────────────────────────────────────────────── */}
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(v) => { if (!v) handleClose() }}
      >
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
              bg-white shadow-2xl shadow-black/10 rounded-xl overflow-hidden
              data-[state=open]:animate-dialog-show
              data-[state=closed]:animate-dialog-hide
            "
          >
            <DialogPrimitive.Title className="sr-only">
              Search tasks
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Search across all your tasks and navigate directly to them.
            </DialogPrimitive.Description>

            {/* Search bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
              <Search size={15} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks…"
                className="flex-1 text-sm text-zinc-900 placeholder:text-zinc-400 bg-transparent outline-none"
              />
              {loading && (
                <Loader2
                  size={13}
                  strokeWidth={1.5}
                  className="animate-spin text-zinc-300 shrink-0"
                />
              )}
              <kbd className="hidden sm:block text-[10px] text-zinc-300 font-mono border border-zinc-100 rounded px-1.5 py-0.5">
                esc
              </kbd>
            </div>

            {/* Results list */}
            <div className="max-h-[360px] overflow-y-auto py-1">
              {!loading && filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <ClipboardList
                    size={20}
                    strokeWidth={1.5}
                    className="text-zinc-200 mb-2"
                  />
                  <p className="text-xs text-zinc-400">
                    {query ? 'No tasks match your search' : 'No active tasks found'}
                  </p>
                </div>
              ) : (
                filtered.map((task, i) => (
                  <button
                    key={task.id}
                    onClick={() => handleSelect(task)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors duration-75',
                      i === activeIndex ? 'bg-zinc-50' : 'hover:bg-zinc-50'
                    )}
                  >
                    <ClipboardList
                      size={14}
                      strokeWidth={1.5}
                      className="text-zinc-300 shrink-0 mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-900 truncate">{task.title}</p>
                      {task.workspaceName && (
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {task.workspaceName}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded capitalize',
                        STATUS_CHIP[task.status] ?? 'bg-zinc-100 text-zinc-500'
                      )}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Footer hints */}
            <div className="px-4 py-2 border-t border-zinc-50 flex items-center gap-4">
              {[
                { key: '↑↓', label: 'navigate' },
                { key: '↵',  label: 'open' },
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
