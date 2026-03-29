'use client'

import { useState, useTransition } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import confetti from 'canvas-confetti'
import type { Task, TaskStatus, TaskPriority } from '@/types/database'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
import { CommentFeed } from './CommentFeed'
import { AttachmentPanel } from './AttachmentPanel'
import { TaskActivityFeed } from './TaskActivityFeed'
import {
  updateTaskStatus,
  updateTaskPriority,
  updateTaskDates,
  updateTaskAssignee,
  deleteTask,
} from '@/app/dashboard/task-actions'
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
  Pencil,
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

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const PRIORITY_VARIANT = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent',
} as const

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
          className="w-full bg-transparent text-lg font-semibold text-zinc-900 dark:text-zinc-100 resize-none leading-snug pb-0.5 border-0 border-b border-zinc-200 dark:border-zinc-700 focus-visible:outline-none focus-visible:border-zinc-400 dark:focus-visible:border-zinc-500 transition-colors duration-150 disabled:opacity-60"
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
  canEdit,
  onSaved,
}: {
  taskId: string
  value: string | null
  canEdit: boolean
  onSaved: (description: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [isPending, startTransition] = useTransition()

  if (!editing && draft !== (value ?? '')) setDraft(value ?? '')

  if (!canEdit) {
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
          className="w-full bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 resize-none leading-relaxed px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 focus-visible:outline-none focus-visible:border-zinc-300 dark:focus-visible:border-zinc-500 focus-visible:shadow-[0_0_0_3px_rgba(0,0,0,0.04)] transition-colors duration-150 disabled:opacity-60"
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
// DatePickerButton — shared date picker trigger button
// ─────────────────────────────────────────────────────────────────────────────
function DatePickerButton({
  label,
  value,
  canEdit,
  onChange,
}: {
  label: string
  value: string | null | undefined
  canEdit: boolean
  onChange: (iso: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? new Date(value) : undefined

  if (!canEdit) {
    return (
      <p className="flex items-center gap-2 h-9 w-full px-3 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
        {value ? formatDisplayDate(value) : <span className="text-zinc-400 italic">Not set</span>}
      </p>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 h-9 w-full px-3 text-sm rounded-lg border transition-colors duration-150',
            'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600',
            'focus-visible:outline-none focus-visible:border-zinc-300 dark:focus-visible:border-zinc-500 focus-visible:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]',
            !value && 'text-zinc-400',
          )}
        >
          <CalendarIcon size={13} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
          <span className={value ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}>
            {value ? formatDisplayDate(value) : `Set ${label}`}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-auto" style={{ zIndex: 9999 }}>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            onChange(d ? toIso(d) : null)
            setOpen(false)
          }}
          initialFocus
        />
        {value && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 px-3 py-2">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
            >
              Clear date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
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

  const INTERNAL_ROLES = ['designer', 'developer', 'marketer', 'project_manager']
  const isAdmin        = currentUserProfile.role === 'admin'
  const isClient       = currentUserProfile.role === 'client'
  const isInternalTeam = INTERNAL_ROLES.includes(currentUserProfile.role)
  // Clients/internal team can edit Status only; admins have full edit access
  const canEdit = isAdmin || isClient
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

  function handlePriorityChange(priority: string) {
    if (!task) return
    const newPriority = priority as TaskPriority
    const original = task
    onTaskUpdated({ ...task, priority: newPriority })
    updateTaskPriority({ taskId: task.id, priority: newPriority }).then(({ error }) => {
      if (error) onTaskUpdated(original)
    })
  }

  function handleStartDateChange(iso: string | null) {
    if (!task) return
    const original = task
    onTaskUpdated({ ...task, start_date: iso })
    updateTaskDates({ taskId: task.id, startDate: iso, dueDate: task.due_date }).then(({ error }) => {
      if (error) onTaskUpdated(original)
    })
  }

  function handleDueDateChange(iso: string | null) {
    if (!task) return
    const original = task
    onTaskUpdated({ ...task, due_date: iso })
    updateTaskDates({ taskId: task.id, startDate: task.start_date, dueDate: iso }).then(({ error }) => {
      if (error) onTaskUpdated(original)
    })
  }

  function handleAssigneeChange(memberId: string) {
    if (!task) return
    const newAssigneeId = memberId === '__none__' ? null : memberId
    const original = task
    onTaskUpdated({ ...task, assignee_id: newAssigneeId })
    updateTaskAssignee({ taskId: task.id, assigneeId: newAssigneeId }).then(({ error }) => {
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

  const selectedMember = task?.assignee_id
    ? workspaceMembers.find((m) => m.id === task.assignee_id)
    : null

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
            'fixed z-50 bg-white dark:bg-[#1A1A1A] flex flex-col overflow-hidden',
            'shadow-2xl shadow-black/15',
            // Mobile fallback positioning (overridden by CSS !important at max-width:767px)
            'left-0 right-0 bottom-0 top-14',
          )}
          style={panelStyle}
        >
          {task ? (
            <>
              {/* ── Header ──────────────────────────────────────────────────── */}
              <div className="flex items-start gap-4 px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-[#1A1A1A]">
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
                  <div className="hidden md:flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 gap-0.5">
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
                            ? 'bg-white dark:bg-zinc-700 shadow-sm text-black dark:text-white'
                            : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                        )}
                      >
                        <Icon size={13} strokeWidth={1.5} />
                      </button>
                    ))}
                  </div>

                  {/* Close */}
                  <DialogPrimitive.Close className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150">
                    <X size={15} strokeWidth={1.5} />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>
              </div>

              {/* ── Body ────────────────────────────────────────────────────── */}
              <div className={cn(
                'flex-1 min-h-0 flex',
                mode === 'sidebar'
                  ? 'flex-col overflow-y-auto'
                  : 'flex-col md:flex-row overflow-y-auto md:overflow-hidden',
              )}>

                {/* ── Left / Main pane ──────────────────────────────────────── */}
                <div className={cn(
                  'px-6 py-5 space-y-6',
                  mode !== 'sidebar' && 'flex-1 overflow-visible md:overflow-y-auto md:border-r md:border-zinc-100 dark:md:border-zinc-800',
                  mode === 'sidebar' && 'w-full',
                )}>

                  {/* Status + Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Status</p>
                      <Select value={task.status} onValueChange={handleStatusChange} disabled={!canEdit && !isInternalTeam}>
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
                      {canEdit ? (
                        <Select value={task.priority} onValueChange={handlePriorityChange}>
                          <SelectTrigger className="rounded-lg">
                            <SelectValue>
                              <Badge variant={PRIORITY_VARIANT[task.priority]}>
                                {task.priority}
                              </Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <Badge variant={PRIORITY_VARIANT[opt.value]}>{opt.label}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center h-9">
                          <Badge variant={PRIORITY_VARIANT[task.priority]}>
                            {task.priority}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                        <CalendarIcon size={10} strokeWidth={1.5} />Start Date
                      </p>
                      {/* Start date is read-only for existing tasks — only editable at creation */}
                      <DatePickerButton
                        label="start date"
                        value={task.start_date}
                        canEdit={false}
                        onChange={handleStartDateChange}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                        <CalendarIcon size={10} strokeWidth={1.5} />Due Date
                      </p>
                      <DatePickerButton
                        label="due date"
                        value={task.due_date}
                        canEdit={canEdit}
                        onChange={handleDueDateChange}
                      />
                    </div>
                  </div>

                  {/* Assignee */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                      <User size={10} strokeWidth={1.5} />Assignee
                    </p>
                    {isAdmin && workspaceMembers.length > 0 ? (
                      <Select
                        value={task.assignee_id ?? '__none__'}
                        onValueChange={handleAssigneeChange}
                      >
                        <SelectTrigger className="rounded-lg">
                          {selectedMember ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="h-5 w-5 shrink-0">
                                {selectedMember.avatar_url && <AvatarImage src={selectedMember.avatar_url} />}
                                <AvatarFallback className="text-[8px] bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                                  {getInitials(selectedMember.full_name || selectedMember.email)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm truncate">
                                {selectedMember.full_name || selectedMember.email}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-zinc-400">Unassigned</span>
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-zinc-400">Unassigned</span>
                          </SelectItem>
                          {workspaceMembers.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5 shrink-0">
                                  {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                                  <AvatarFallback className="text-[8px] bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                                    {getInitials(m.full_name || m.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{m.full_name || m.email}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : task.assignee_id && assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 shrink-0">
                          {assignee.avatar_url && <AvatarImage src={assignee.avatar_url} />}
                          <AvatarFallback className="text-[9px] bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                            {getInitials(assignee.full_name || assignee.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-zinc-900">{assignee.full_name || assignee.email}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-400 italic">Unassigned</p>
                    )}
                  </div>

                  {/* Client: Approve Design */}
                  {isClient && task.status === 'review' && (
                    <button
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="w-full h-11 flex items-center justify-center gap-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-zinc-800 active:bg-zinc-900 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isApproving
                        ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                        : <CheckCircle2 size={16} strokeWidth={1.5} />
                      }
                      {isApproving ? 'Approving…' : 'Approve Design'}
                    </button>
                  )}

                  {/* Description */}
                  <div className="space-y-1.5 group/desc">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Description</p>
                      {canEdit && (
                        <Pencil
                          size={10}
                          strokeWidth={1.5}
                          className="text-zinc-300 opacity-0 group-hover/desc:opacity-100 transition-opacity"
                        />
                      )}
                    </div>
                    <EditableDescription
                      taskId={task.id}
                      value={task.description}
                      canEdit={canEdit}
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
                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
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
                <div className={cn(
                  'px-6 pb-6 bg-[#F9FAFB] dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800',
                  mode !== 'sidebar' && 'md:w-[360px] md:shrink-0 md:overflow-y-auto md:border-t-0',
                  mode === 'sidebar' && 'w-full',
                )}>
                  {/* ── Audit Trail ───────────────────────────────────────── */}
                  <div className="sticky top-0 bg-[#F9FAFB] dark:bg-zinc-900 pt-5 pb-3 mb-3 border-b border-zinc-100 dark:border-zinc-800 z-10">
                    <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
                      History
                    </p>
                  </div>
                  <TaskActivityFeed taskId={task.id} />

                  {/* ── Comments ──────────────────────────────────────────── */}
                  <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3">
                      Comments
                    </p>
                    <CommentFeed
                      taskId={task.id}
                      currentUserProfile={currentUserProfile}
                      members={workspaceMembers}
                    />
                  </div>
                </div>

              </div>
            </>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
