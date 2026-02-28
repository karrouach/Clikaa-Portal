'use client'

import { useState, useTransition } from 'react'
import type { Task, TaskStatus } from '@/types/database'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
} from '@/components/ui/sheet'
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
import { formatDate } from '@/lib/utils'
import { Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CurrentUserProfile {
  id: string
  role: 'admin' | 'client'
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
}

// ─── Status options ───────────────────────────────────────────────────────────
const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
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

  // Keep draft in sync when the parent value changes (e.g. realtime update)
  if (!editing && draft !== value) {
    setDraft(value)
  }

  if (!isAdmin) {
    return (
      <h2 className="text-base font-semibold text-black leading-snug pr-8">
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
          setDraft(value) // revert on error
        }
        setEditing(false)
      })
    }

    return (
      <div className="relative pr-8">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              save()
            }
            if (e.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
          rows={2}
          disabled={isPending}
          className="
            w-full bg-transparent text-base font-semibold text-black
            resize-none focus:outline-none leading-snug
            border-0 border-b border-zinc-300 focus:border-black
            transition-colors pb-0.5
            disabled:opacity-60
          "
        />
        {isPending && (
          <Loader2
            size={12}
            strokeWidth={1.5}
            className="absolute right-0 top-1 animate-spin text-zinc-400"
          />
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to edit title"
      className="block w-full text-left pr-8 group"
    >
      <h2 className="text-base font-semibold text-black leading-snug group-hover:text-zinc-700 transition-colors">
        {value}
      </h2>
      <p className="text-[10px] text-zinc-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        Click to edit
      </p>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EditableDescription — textarea for admins, plain text for clients
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

  // Sync draft when parent value changes (realtime)
  if (!editing && draft !== (value ?? '')) {
    setDraft(value ?? '')
  }

  if (!isAdmin) {
    return value ? (
      <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
        {value}
      </p>
    ) : (
      <p className="text-sm text-zinc-400 italic">No description provided.</p>
    )
  }

  if (editing) {
    function save() {
      const trimmed = draft.trim() || null
      if (trimmed === value) {
        setEditing(false)
        return
      }
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
            if (e.key === 'Escape') {
              setDraft(value ?? '')
              setEditing(false)
            }
          }}
          rows={4}
          placeholder="Add a description…"
          disabled={isPending}
          className="
            w-full bg-transparent text-sm text-black placeholder:text-zinc-400
            resize-none focus:outline-none leading-relaxed
            border border-zinc-200 focus:border-black
            transition-colors px-3 py-2
            disabled:opacity-60
          "
        />
        {isPending && (
          <Loader2
            size={12}
            strokeWidth={1.5}
            className="absolute right-2.5 bottom-2.5 animate-spin text-zinc-400"
          />
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="block w-full text-left group"
    >
      {value ? (
        <p
          className={cn(
            'text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap',
            'group-hover:text-zinc-800 transition-colors'
          )}
        >
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
// TaskDetailSheet — right-side sheet for full task detail + communication
// ─────────────────────────────────────────────────────────────────────────────
export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  currentUserProfile,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailSheetProps) {
  const [isDeleting, startDeleteTransition] = useTransition()
  const isAdmin = currentUserProfile.role === 'admin'

  // ── Status change — optimistic, with revert on error ──────────────────────
  function handleStatusChange(status: string) {
    if (!task) return
    const newStatus = status as TaskStatus
    const original = task
    const optimistic = { ...task, status: newStatus }

    onTaskUpdated(optimistic) // Immediate optimistic update

    updateTaskStatus({ taskId: task.id, status: newStatus }).then(({ error }) => {
      if (error) {
        console.error('[TaskDetail] Status update failed:', error)
        onTaskUpdated(original) // Revert
      }
    })
  }

  // ── Title saved ───────────────────────────────────────────────────────────
  function handleTitleSaved(title: string) {
    if (!task) return
    onTaskUpdated({ ...task, title })
  }

  // ── Description saved ─────────────────────────────────────────────────────
  function handleDescriptionSaved(description: string | null) {
    if (!task) return
    onTaskUpdated({ ...task, description })
  }

  // ── Delete (admin only) ───────────────────────────────────────────────────
  function handleDelete() {
    if (!task) return
    startDeleteTransition(async () => {
      const { error } = await deleteTask(task.id)
      if (!error) {
        onTaskDeleted(task.id)
        onOpenChange(false)
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {task ? (
          <>
            {/* ── Header ──────────────────────────────────────────────────── */}
            <SheetHeader>
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

            {/* ── Body (scrollable) ────────────────────────────────────────── */}
            <SheetBody>
              <div className="space-y-6">
                {/* ── Status + Priority ────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Status */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
                      Status
                    </p>
                    <Select
                      value={task.status}
                      onValueChange={handleStatusChange}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority (read-only) */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
                      Priority
                    </p>
                    <div className="flex items-center h-8">
                      <Badge variant={PRIORITY_VARIANT[task.priority]}>
                        {task.priority}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* ── Description ──────────────────────────────────────────── */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
                    Description
                  </p>
                  <EditableDescription
                    taskId={task.id}
                    value={task.description}
                    isAdmin={isAdmin}
                    onSaved={handleDescriptionSaved}
                  />
                </div>

                {/* ── Attachments ──────────────────────────────────────────── */}
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
                    Attachments
                  </p>
                  <AttachmentPanel
                    taskId={task.id}
                    workspaceId={task.workspace_id}
                    currentUserProfile={currentUserProfile}
                  />
                </div>

                {/* ── Activity / Comments ───────────────────────────────────── */}
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
                    Activity
                  </p>
                  <CommentFeed
                    taskId={task.id}
                    currentUserProfile={currentUserProfile}
                  />
                </div>

                {/* ── Admin: Delete task ────────────────────────────────────── */}
                {isAdmin && (
                  <div className="pt-4 border-t border-zinc-100">
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="
                        flex items-center gap-1.5 text-xs text-zinc-400
                        hover:text-red-500 transition-colors duration-150
                        disabled:opacity-50 disabled:cursor-not-allowed
                      "
                    >
                      {isDeleting ? (
                        <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} strokeWidth={1.5} />
                      )}
                      Delete task
                    </button>
                  </div>
                )}
              </div>
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
