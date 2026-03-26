'use client'

import { useState, useTransition, useRef } from 'react'
import { Plus, Loader2, AlertCircle, CalendarIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createTask } from '@/app/dashboard/task-actions'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Task } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemberOption = {
  id: string
  full_name: string
  email: string
  avatar_url?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

type FieldErrors = {
  title?: string
  assigneeId?: string
  dueDate?: string
}

interface CreateTaskDialogProps {
  workspaceId: string
  onTaskCreated: (task: Task) => void
  asFab?: boolean
  members?: MemberOption[]
}

export function CreateTaskDialog({
  workspaceId,
  onTaskCreated,
  asFab = false,
  members,
}: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  // Controlled fields
  const [priority, setPriority] = useState('medium')
  const [assigneeId, setAssigneeId] = useState('__none__')
  const selectedMember = (members ?? []).find((m) => m.id === assigneeId)

  // Date pickers — start date defaults to today
  const [startDate, setStartDate] = useState<Date | undefined>(() => new Date())
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [startOpen, setStartOpen] = useState(false)
  const [dueOpen, setDueOpen] = useState(false)

  const hasMembers = !!(members && members.length > 0)

  function handleOpenChange(next: boolean) {
    if (!isPending) {
      setOpen(next)
      if (!next) {
        setServerError(null)
        setFieldErrors({})
        setPriority('medium')
        setAssigneeId('__none__')
        setStartDate(new Date())
        setDueDate(undefined)
        formRef.current?.reset()
      }
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    // ── Client-side validation ────────────────────────────────────────────────
    const titleVal = (formData.get('title') as string ?? '').trim()
    const newErrors: FieldErrors = {}
    if (!titleVal)                              newErrors.title      = 'Title is required.'
    if (!dueDate)                               newErrors.dueDate    = 'Due date is required.'
    if (hasMembers && assigneeId === '__none__') newErrors.assigneeId = 'Please assign this task.'

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors)
      return
    }
    setFieldErrors({})
    setServerError(null)

    // ── Build FormData ────────────────────────────────────────────────────────
    formData.set('workspace_id', workspaceId)
    formData.set('priority', priority)
    formData.set('assignee_id', assigneeId === '__none__' ? '' : assigneeId)
    formData.set('start_date', startDate ? toIso(startDate) : '')
    formData.set('due_date', dueDate ? toIso(dueDate) : '')

    startTransition(async () => {
      const result = await createTask(formData)
      if (result.error) {
        setServerError(result.error)
        return
      }
      if (result.task) {
        onTaskCreated(result.task)
        handleOpenChange(false)
      }
    })
  }

  return (
    <>
      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      {asFab ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Add task"
          className="
            fixed bottom-24 right-4 z-30
            w-14 h-14 rounded-full
            bg-black text-white shadow-xl shadow-black/20
            flex items-center justify-center
            active:bg-zinc-800 transition-colors
          "
        >
          <Plus size={22} strokeWidth={1.5} />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="
            flex items-center gap-1.5 h-9 px-4
            bg-black text-white text-sm font-medium rounded-lg
            hover:bg-zinc-800 active:bg-zinc-900
            transition-colors duration-150
          "
        >
          <Plus size={14} strokeWidth={1.5} />
          New Task
        </button>
      )}

      {/* ── Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Create new task</DialogTitle>
            <DialogDescription>
              This task will appear at the top of the{' '}
              <span className="text-black font-medium">To Do</span> column.
            </DialogDescription>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-5">
            {/* Server error banner */}
            {serverError && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                {serverError}
              </div>
            )}

            {/* ── Title ─────────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <label
                htmlFor="task-title"
                className="block text-[11px] font-medium text-zinc-600 uppercase tracking-widest"
              >
                Title <span className="text-red-400 normal-case tracking-normal">*</span>
              </label>
              <Input
                id="task-title"
                name="title"
                type="text"
                autoFocus
                placeholder="What needs to be done?"
                onChange={() => setFieldErrors(p => ({ ...p, title: undefined }))}
                className={cn(fieldErrors.title && 'border-red-300 focus-visible:border-red-400 focus-visible:shadow-[0_0_0_3px_rgba(239,68,68,0.08)]')}
              />
              {fieldErrors.title && (
                <p className="text-xs text-red-500">{fieldErrors.title}</p>
              )}
            </div>

            {/* ── Description ───────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <label
                htmlFor="task-description"
                className="block text-[11px] font-medium text-zinc-600 uppercase tracking-widest"
              >
                Description
              </label>
              <Textarea
                id="task-description"
                name="description"
                rows={3}
                placeholder="Add any relevant context, links, or details…"
              />
            </div>

            {/* ── Priority ──────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-zinc-600 uppercase tracking-widest">
                Priority
              </label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Start Date + Due Date ──────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              {/* Start Date */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-zinc-600 uppercase tracking-widest">
                  Start Date
                </p>
                <Popover open={startOpen} onOpenChange={setStartOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="
                        w-full flex items-center gap-2 h-9 px-3 text-sm
                        rounded-lg border border-zinc-200 bg-white
                        hover:border-zinc-300 transition-colors duration-150
                        focus-visible:outline-none focus-visible:border-zinc-300 focus-visible:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]
                      "
                    >
                      <CalendarIcon size={13} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
                      <span className={startDate ? 'text-black' : 'text-zinc-400'}>
                        {startDate ? formatDate(startDate) : 'Pick date'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => { setStartDate(d); setStartOpen(false) }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-zinc-600 uppercase tracking-widest">
                  Due Date <span className="text-red-400">*</span>
                </p>
                <Popover open={dueOpen} onOpenChange={setDueOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'w-full flex items-center gap-2 h-9 px-3 text-sm',
                        'rounded-lg border bg-white',
                        'hover:border-zinc-300 transition-colors duration-150',
                        'focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]',
                        fieldErrors.dueDate
                          ? 'border-red-300 focus-visible:border-red-400'
                          : 'border-zinc-200 focus-visible:border-zinc-300',
                      )}
                    >
                      <CalendarIcon size={13} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
                      <span className={dueDate ? 'text-black' : 'text-zinc-400'}>
                        {dueDate ? formatDate(dueDate) : 'Pick date'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-0">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(d) => {
                        setDueDate(d)
                        setDueOpen(false)
                        setFieldErrors(p => ({ ...p, dueDate: undefined }))
                      }}
                      disabled={startDate ? { before: startDate } : undefined}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {fieldErrors.dueDate && (
                  <p className="text-xs text-red-500">{fieldErrors.dueDate}</p>
                )}
              </div>
            </div>

            {/* ── Assignee ──────────────────────────────────────────────── */}
            {hasMembers && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-600 uppercase tracking-widest">
                  Assignee <span className="text-red-400">*</span>
                </label>
                <Select
                  value={assigneeId}
                  onValueChange={(v) => {
                    setAssigneeId(v)
                    setFieldErrors(p => ({ ...p, assigneeId: undefined }))
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      'h-9 rounded-lg',
                      fieldErrors.assigneeId && 'border-red-300 focus:border-red-400',
                    )}
                  >
                    {assigneeId !== '__none__' && selectedMember ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-5 w-5 shrink-0">
                          {selectedMember.avatar_url && (
                            <AvatarImage src={selectedMember.avatar_url} />
                          )}
                          <AvatarFallback className="text-[8px] bg-zinc-100 text-zinc-600">
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
                    {members!.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5 shrink-0">
                            {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                            <AvatarFallback className="text-[8px] bg-zinc-100 text-zinc-600">
                              {getInitials(m.full_name || m.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{m.full_name || m.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.assigneeId && (
                  <p className="text-xs text-red-500">{fieldErrors.assigneeId}</p>
                )}
              </div>
            )}

            {/* ── Actions ───────────────────────────────────────────────── */}
            <div className="flex items-center justify-end gap-3 pt-1 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
                className="h-9 px-4 text-sm text-zinc-500 hover:text-black transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isPending}
                className="
                  flex items-center gap-2 h-9 px-5
                  bg-black text-white text-sm font-medium rounded-lg
                  hover:bg-zinc-800 transition-colors
                  disabled:opacity-60 disabled:cursor-not-allowed
                "
              >
                {isPending && <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />}
                {isPending ? 'Creating…' : 'Create task'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
