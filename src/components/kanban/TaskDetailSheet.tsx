'use client'

import { useState, useTransition } from 'react'
import confetti from 'canvas-confetti'
import type { Task, TaskStatus } from '@/types/database'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
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
import { CheckCircle2, Loader2, Trash2, CalendarIcon, User, PanelRight, Maximize2 } from 'lucide-react'
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

type LayoutMode = 'sidebar' | 'modal'
const LAYOUT_KEY = 'clikaa_task_layout'

// ─── Status options ───────────────────────────────────────────────────────────
const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo',        label: 'To Do' },
  { value: 'pending',     label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review',      label: 'Review' },
  { value: 'done',        label: 'Done' },
]

// ─── Priority badge map ───────────────────────────────────────────────────────
const PRIORITY_VARIANT = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// EditableTitle — inline title editing for admins, read-only for clients
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

  if (!editing && draft !== value) {
    setDraft(value)
  }

  if (!isAdmin) {
    return (
      <h2 className="text-base font-semibold text-zinc-900 leading-snug pr-16">
        {value}
      </h2>
    )
  }

  if (editing) {
    function save() {
      const trimmed = draft.trim()
      if (!trimmed || trimmed === value) {
        setDraft(value)
        setEditing(false)
        return
      }
      startTransition(async () => {
        const result = await updateTaskTitle({ taskId, title: trimmed })
        if (!result.error && result.task) {
          onSaved(result.task.title)
        } else {
          setDraft(value)
        }
        setEditing(false)
      })
    }

    return (
      <div className="relative pr-16">
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
          className="
            w-full bg-transparent text-base font-semibold text-zinc-900
            resize-none leading-snug pb-0.5
            border-0 border-b border-zinc-200
            focus-visible:outline-none focus-visible:border-zinc-900
            transition-colors duration-150
            disabled:opacity-60 disabled:cursor-not-allowed
          "
        />
        {isPending && (
          <Loader2 size={12} strokeWidth={1.5} className="absolute right-0 top-1 animate-spin text-zinc-400" />
        )}
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} title="Click to edit title" className="block w-full text-left pr-16 group">
      <h2 className="text-base font-semibold text-zinc-900 leading-snug group-hover:text-zinc-600 transition-colors">
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

  if (!editing && draft !== (value ?? '')) {
    setDraft(value ?? '')
  }

  if (!isAdmin) {
    return value ? (
      <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">{value}</p>
    ) : (
      <p className="text-sm text-zinc-400 italic">No description provided.</p>
    )
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
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
          }}
          rows={4}
          placeholder="Add a description…"
          disabled={isPending}
          className="
            w-full bg-white text-sm text-zinc-900 placeholder:text-zinc-500
            resize-none leading-relaxed px-3 py-2
            rounded-md border border-zinc-200
            hover:border-zinc-300
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2
            transition-colors duration-150
            disabled:opacity-60 disabled:cursor-not-allowed
          "
        />
        {isPending && (
          <Loader2 size={12} strokeWidth={1.5} className="absolute right-2.5 bottom-2.5 animate-spin text-zinc-400" />
        )}
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="block w-full text-left group">
      {value ? (
        <p className={cn('text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap', 'group-hover:text-zinc-800 transition-colors')}>
          {value}
        </p>
      ) : (
        <p className="text-sm text-zinc-400 italic group-hover:text-zinc-500 transition-colors">
          Add a description…
        </p>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskDetailSheet — modal or sidebar, toggled by the user with localStorage
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

  // Layout mode — persisted in localStorage
  const [mode, setMode] = useState<LayoutMode>(() => {
    if (typeof window === 'undefined') return 'sidebar'
    return (localStorage.getItem(LAYOUT_KEY) as LayoutMode) ?? 'sidebar'
  })

  const isAdmin = currentUserProfile.role === 'admin'
  const isClient = currentUserProfile.role === 'client'
  const assignee = task?.assignee_id
    ? workspaceMembers.find((m) => m.id === task.assignee_id) ?? null
    : null

  function toggleMode() {
    const next: LayoutMode = mode === 'sidebar' ? 'modal' : 'sidebar'
    setMode(next)
    try { localStorage.setItem(LAYOUT_KEY, next) } catch { /* ignore */ }
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

  // ── Shared layout-toggle button ──────────────────────────────────────────
  const LayoutToggle = (
    <button
      onClick={toggleMode}
      title={mode === 'sidebar' ? 'Switch to modal view' : 'Switch to sidebar view'}
      className="absolute right-12 top-5 text-zinc-400 hover:text-black transition-colors duration-150"
    >
      {mode === 'sidebar'
        ? <Maximize2 size={15} strokeWidth={1.5} />
        : <PanelRight size={15} strokeWidth={1.5} />
      }
    </button>
  )

  // ── Shared task body ──────────────────────────────────────────────────────
  const taskBody = task ? (
    <>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <SheetHeader>
        {LayoutToggle}
        <EditableTitle
          taskId={task.id}
          value={task.title}
          isAdmin={isAdmin}
          onSaved={handleTitleSaved}
        />
        <p className="text-[11px] text-zinc-400 mt-1.5">
          Created {formatDate(task.created_at)}
        </p>
      </SheetHeader>

      {/* ── Body (scrollable) ─────────────────────────────────────────────── */}
      <SheetBody>
        <div className="space-y-6">
          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Status</p>
              <Select value={task.status} onValueChange={handleStatusChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
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

          {/* Client Approve Design */}
          {isClient && task.status === 'review' && (
            <button
              onClick={handleApprove}
              disabled={isApproving}
              className="
                w-full h-11 flex items-center justify-center gap-2
                bg-emerald-500 text-white text-sm font-semibold rounded-lg
                hover:bg-emerald-600 active:bg-emerald-700
                transition-colors duration-150
                disabled:opacity-60 disabled:cursor-not-allowed
              "
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

          {/* Activity / Comments */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Activity</p>
            <CommentFeed taskId={task.id} currentUserProfile={currentUserProfile} />
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
      </SheetBody>
    </>
  ) : null

  // ── Sidebar mode (default) ────────────────────────────────────────────────
  if (mode === 'sidebar') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          {taskBody}
        </SheetContent>
      </Sheet>
    )
  }

  // ── Modal mode ────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] p-0 max-h-[90vh] flex flex-col overflow-hidden">
        {taskBody}
      </DialogContent>
    </Dialog>
  )
}
