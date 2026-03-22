'use client'

import { useState, useTransition } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import confetti from 'canvas-confetti'
import type { Task, TaskStatus } from '@/types/database'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CommentFeed } from './CommentFeed'
import { AttachmentPanel } from './AttachmentPanel'
import { updateTaskStatus, deleteTask } from '@/app/dashboard/task-actions'
import { updateTaskTitle, updateTaskDescription } from '@/app/dashboard/comment-actions'
import { formatDate, getInitials } from '@/lib/utils'
import {
  CheckCircle2,
  Loader2,
  Trash2,
  CalendarIcon,
  User,
  X,
  LayoutGrid,
  Maximize2,
  PanelRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { MemberOption } from './CreateTaskDialog'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CurrentUserProfile {
  id: string
  role: 'admin' | 'client' | 'designer'
  full_name: string
  avatar_url: string | null
  email: string
}

interface TaskDetailSheetProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserProfile: CurrentUserProfile
  onTaskUpdated: (task: Task) => void
  onTaskDeleted: (taskId: string) => void
  workspaceMembers?: MemberOption[]
}

type LayoutMode = 'modal' | 'fullscreen' | 'sidebar'
const LAYOUT_KEY = 'clikaa_task_layout'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo',        label: 'To Do' },
  { value: 'pending',     label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review',      label: 'Review' },
  { value: 'done',        label: 'Done' },
]

const PRIORITY_VARIANT = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// EditableTitle
// ─────────────────────────────────────────────────────────────────────────────
function EditableTitle({
  taskId,
  value,
  isAdmin,
  onSaved,
}: {
  taskId: string
  value: string
  isAdmin: boolean
  onSaved: (title: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [isPending, startTransition] = useTransition()

  if (!editing && draft !== value) setDraft(value)

  if (!isAdmin) {
    return <h2 className="text-lg font-semibold text-zinc-900 leading-snug">{value}</h2>
  }

  if (editing) {
    function save() {
      const trimmed = draft.trim()
      if (!trimmed || trimmed === value) { setDraft(value); setEditing(false); return }
      startTransition(async () => {
        const result = await updateTaskTitle({ taskId, title: trimmed })
        if (!result.error && result.task) onSaved(result.task.title)
        else setDraft(value)
        setEditing(false)
      })
    }

    return (
      <div className="relative">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
            if (e.key === 'Escape') { setDraft(value); setEditing(false) }
          }}
          rows={2}
          disabled={isPending}
          className="w-full bg-transparent text-lg font-semibold text-zinc-900 resize-none leading-snug pb-0.5 border-0 border-b border-zinc-200 focus-visible:outline-none focus-visible:border-zinc-900 transition-colors duration-150 disabled:opacity-60"
        />
        {isPending && <Loader2 size={12} strokeWidth={1.5} className="absolute right-0 top-1 animate-spin text-zinc-400" />}
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} title="Click to edit title" className="block w-full text-left group">
      <h2 className="text-lg font-semibold text-zinc-900 leading-snug group-hover:text-zinc-600 transition-colors">
        {value}
      </h2>
      <p className="text-[10px] text-zinc-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        Click to edit
      </p>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EditableDescription
// ─────────────────────────────────────────────────────────────────────────────
function EditableDescription({
  taskId,
  value,
  isAdmin,
  onSaved,
}: {
  taskId: string
  value: string | null
  isAdmin: boolean
  onSaved: (description: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [isPending, startTransition] = useTransition()

  if (!editing && draft !== (value ?? '')) setDraft(value ?? '')

  if (!isAdmin) {
    return value
      ? <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">{value}</p>
      : <p className="text-sm text-zinc-400 italic">No description provided.</p>
  }

  if (editing) {
    function save() {
      const trimmed = draft.trim() || null
      if (trimmed === value) { setEditing(false); return }
      startTransition(async () => {
        await updateTaskDescription({ taskId, description: trimmed })
        onSaved(trimmed)
        setEditing(false)
      })
    }

    return (
      <div className="relative">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) } }}
          rows={5}
          placeholder="Add a description…"
          disabled={isPending}
          className="w-full bg-white text-sm text-zinc-900 placeholder:text-zinc-400 resize-none leading-relaxed px-3 py-2.5 rounded-lg border border-zinc-200 hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 transition-colors duration-150 disabled:opacity-60"
        />
        {isPending && <Loader2 size={12} strokeWidth={1.5} className="absolute right-2.5 bottom-2.5 animate-spin text-zinc-400" />}
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="block w-full text-left group">
      {value
        ? <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap group-hover:text-zinc-800 transition-colors">{value}</p>
        : <p className="text-sm text-zinc-400 italic group-hover:text-zinc-500 transition-colors">Add a description…</p>
      }
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskDetailSheet
// ─────────────────────────────────────────────────────────────────────────────
export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  currentUserProfile,
  onTaskUpdated,
  onTaskDeleted,
  workspaceMembers = [],
}: TaskDetailSheetProps) {
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isApproving, startApproveTransition] = useTransition()

  const [mode, setMode] = useState<LayoutMode>(() => {
    if (typeof window === 'undefined') return 'modal'
    return (localStorage.getItem(LAYOUT_KEY) as LayoutMode) ?? 'modal'
  })

  const isAdmin = currentUserProfile.role === 'admin'
  const isClient = currentUserProfile.role === 'client'
  const assignee = task?.assignee_id
    ? workspaceMembers.find((m) => m.id === task.assignee_id) ?? null
    : null

  function handleModeChange(newMode: LayoutMode) {
    setMode(newMode)
    try { localStorage.setItem(LAYOUT_KEY, newMode) } catch { /* ignore */ }
  }

  function handleStatusChange(status: string) {
    if (!task) return
    const newStatus = status as TaskStatus
    const original = task
    onTaskUpdated({ ...task, status: newStatus })
    updateTaskStatus({ taskId: task.id, status: newStatus }).then(({ error }) => {
      if (error) onTaskUpdated(original)
    })
  }

  function handleApprove() {
    if (!task) return
    const original = task
    onTaskUpdated({ ...task, status: 'done' as TaskStatus })
    startApproveTransition(async () => {
      const { error } = await updateTaskStatus({ taskId: task.id, status: 'done' })
      if (error) { onTaskUpdated(original); return }
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.55 }, colors: ['#000000', '#10b981', '#ffffff', '#71717a', '#f59e0b'] })
    })
  }

  function handleTitleSaved(title: string) {
    if (!task) return
    onTaskUpdated({ ...task, title })
  }

  function handleDescriptionSaved(description: string | null) {
    if (!task) return
    onTaskUpdated({ ...task, description })
  }

  function handleDelete() {
    if (!task) return
    startDeleteTransition(async () => {
      const { error } = await deleteTask(task.id)
      if (!error) { onTaskDeleted(task.id); onOpenChange(false) }
    })
  }

  // ── Desktop panel positioning (overridden on mobile via CSS !important) ───
  const panelStyle: React.CSSProperties =
    mode === 'modal'
      ? {
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '1152px',
          height: '88vh',
          borderRadius: '16px',
        }
      : mode === 'fullscreen'
      ? {
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          bottom: '1rem',
          left: '1rem',
          borderRadius: '16px',
        }
      : {
          // sidebar
          position: 'fixed',
          right: '0',
          top: '0',
          bottom: '0',
          left: 'auto',
          height: '100%',
          width: '480px',
          maxWidth: '100%',
          borderRadius: '0',
        }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* ── Backdrop ────────────────────────────────────────────────────── */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-overlay-show data-[state=closed]:animate-overlay-hide"
        />

        {/* ── Panel ───────────────────────────────────────────────────────── */}
        <DialogPrimitive.Content
          className={cn(
            // Animation classes — mobile base + desktop overrides via globals.css
            'task-panel',
            mode === 'modal'      && 'task-panel-modal',
            mode === 'fullscreen' && 'task-panel-fullscreen',
            mode === 'sidebar'    && 'task-panel-sidebar',
            // Base layout
            'fixed z-50 bg-white flex flex-col overflow-hidden',
            'shadow-2xl shadow-black/15',
            // Mobile fallback positioning (overridden by CSS !important at max-width:767px)
            'left-0 right-0 bottom-0 top-14',
          )}
          style={panelStyle}
        >
          {task ? (
            <>
              {/* ── Header ──────────────────────────────────────────────────── */}
              <div className="flex items-start gap-4 px-6 py-5 border-b border-zinc-100 shrink-0 bg-white">
                <div className="flex-1 min-w-0">
                  <EditableTitle
                    taskId={task.id}
                    value={task.title}
                    isAdmin={isAdmin}
                    onSaved={handleTitleSaved}
                  />
                  <p className="text-[11px] text-zinc-400 mt-1.5">
                    Created {formatDate(task.created_at)}
                  </p>
                </div>

                {/* Controls: layout toggle (desktop) + close */}
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  {/* Layout toggle — desktop only */}
                  <div className="hidden md:flex items-center bg-zinc-100 rounded-lg p-0.5 gap-0.5">
                    {(
                      [
                        { id: 'modal',      icon: LayoutGrid, title: 'Modal' },
                        { id: 'fullscreen', icon: Maximize2,  title: 'Full screen' },
                        { id: 'sidebar',    icon: PanelRight, title: 'Sidebar' },
                      ] as const
                    ).map(({ id, icon: Icon, title }) => (
                      <button
                        key={id}
                        onClick={() => handleModeChange(id)}
                        title={title}
                        className={cn(
                          'p-1.5 rounded-md transition-all duration-150',
                          mode === id
                            ? 'bg-white shadow-sm text-black'
                            : 'text-zinc-400 hover:text-zinc-600'
                        )}
                      >
                        <Icon size={13} strokeWidth={1.5} />
                      </button>
                    ))}
                  </div>

                  {/* Close */}
                  <DialogPrimitive.Close className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100 transition-all duration-150">
                    <X size={15} strokeWidth={1.5} />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>
              </div>

              {/* ── Body: two-column on desktop, stacked on mobile ──────────── */}
              {/*
                  Mobile (flex-col, overflow-y-auto on wrapper):
                    Both panes stack vertically; content scrolls as one unit.
                  Desktop (md:flex-row, md:overflow-hidden):
                    Left pane scrolls independently; right pane scrolls independently.
              */}
              <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

                {/* ── Left / Main pane ──────────────────────────────────────── */}
                <div className="flex-1 overflow-visible md:overflow-y-auto px-6 py-5 md:border-r md:border-zinc-100 space-y-6">

                  {/* Status + Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Status</p>
                      <Select value={task.status} onValueChange={handleStatusChange}>
                        <SelectTrigger className="rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Priority</p>
                      <div className="flex items-center h-8">
                        <Badge variant={PRIORITY_VARIANT[task.priority]} className="rounded-lg">
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Dates + Assignee */}
                  {(task.start_date || task.due_date || task.assignee_id) && (
                    <div className="grid grid-cols-2 gap-4">
                      {task.start_date && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                            <CalendarIcon size={10} strokeWidth={1.5} />Start Date
                          </p>
                          <p className="text-sm text-zinc-900">
                            {new Date(task.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      )}
                      {task.due_date && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                            <CalendarIcon size={10} strokeWidth={1.5} />Due Date
                          </p>
                          <p className="text-sm text-zinc-900">
                            {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      )}
                      {task.assignee_id && (
                        <div className="space-y-1.5 col-span-2">
                          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                            <User size={10} strokeWidth={1.5} />Assignee
                          </p>
                          {assignee ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6 shrink-0">
                                {assignee.avatar_url && <AvatarImage src={assignee.avatar_url} />}
                                <AvatarFallback className="text-[9px] bg-zinc-100 text-zinc-600">
                                  {getInitials(assignee.full_name || assignee.email)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-zinc-900">{assignee.full_name || assignee.email}</span>
                            </div>
                          ) : (
                            <p className="text-sm text-zinc-400">Unknown member</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Client: Approve Design */}
                  {isClient && task.status === 'review' && (
                    <button
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="w-full h-11 flex items-center justify-center gap-2 bg-emerald-500 text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 active:bg-emerald-700 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isApproving
                        ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                        : <CheckCircle2 size={16} strokeWidth={1.5} />
                      }
                      {isApproving ? 'Approving…' : 'Approve Design'}
                    </button>
                  )}

                  {/* Description */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Description</p>
                    <EditableDescription
                      taskId={task.id}
                      value={task.description}
                      isAdmin={isAdmin}
                      onSaved={handleDescriptionSaved}
                    />
                  </div>

                  {/* Attachments */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Attachments</p>
                    <AttachmentPanel
                      taskId={task.id}
                      workspaceId={task.workspace_id}
                      currentUserProfile={currentUserProfile}
                    />
                  </div>

                  {/* Admin: Delete */}
                  {isAdmin && (
                    <div className="pt-4 border-t border-zinc-100">
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeleting
                          ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                          : <Trash2 size={12} strokeWidth={1.5} />
                        }
                        Delete task
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Right / Activity pane ─────────────────────────────────── */}
                <div className="overflow-visible md:overflow-y-auto md:w-[360px] md:shrink-0 px-6 py-5 bg-[#F9FAFB] border-t border-zinc-100 md:border-t-0">
                  {/* Sticky label — scrolls with content on mobile, sticks on desktop */}
                  <div className="sticky top-0 bg-[#F9FAFB] pb-3 mb-1 z-10">
                    <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
                      Activity
                    </p>
                  </div>
                  <CommentFeed taskId={task.id} currentUserProfile={currentUserProfile} />
                </div>

              </div>
            </>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
