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

// ─── Native select style (underline variant matching Input underline) ──────────
const selectClass =
  'w-full bg-transparent text-sm text-foreground ' +
  'h-10 px-0 border-0 border-b border-input rounded-none ' +
  'focus-visible:outline-none focus-visible:border-foreground ' +
  'transition-colors duration-150 cursor-pointer appearance-none ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

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
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  // Controlled assignee (Radix Select is not a native form element)
  const [assigneeId, setAssigneeId] = useState('__none__')
  const selectedMember = (members ?? []).find((m) => m.id === assigneeId)

  // Controlled date pickers
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [startOpen, setStartOpen] = useState(false)
  const [dueOpen, setDueOpen] = useState(false)

  function handleOpenChange(next: boolean) {
    if (!isPending) {
      setOpen(next)
      if (!next) {
        setError(null)
        setAssigneeId('__none__')
        setStartDate(undefined)
        setDueDate(undefined)
        formRef.current?.reset()
      }
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('workspace_id', workspaceId)
    formData.set('assignee_id', assigneeId === '__none__' ? '' : assigneeId)
    formData.set('start_date', startDate ? toIso(startDate) : '')
    formData.set('due_date', dueDate ? toIso(dueDate) : '')
    setError(null)

    startTransition(async () => {
      const result = await createTask(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.task) {
        onTaskCreated(result.task)
        handleOpenChange(false)
      }
    })
  }

  const hasMembers = members && members.length > 0

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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create new task</DialogTitle>
            <DialogDescription>
              This task will appear at the top of the{' '}
              <span className="text-black font-medium">To Do</span> column.
            </DialogDescription>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Title */}
            <div className="space-y-1.5">
              <label
                htmlFor="task-title"
                className="block text-[11px] font-medium text-zinc-600 uppercase tracking-widest"
              >
                Title <span className="text-red-400 normal-case tracking-normal">*</span>
              </label>
              <Input
                underline
                id="task-title"
                name="title"
                type="text"
                required
                autoFocus
                placeholder="What needs to be done?"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label
                htmlFor="task-description"
                className="block text-[11px] font-medium text-zinc-600 uppercase tracking-widest"
              >
                Description
              </label>
              <Textarea
                underline
                id="task-description"
                name="description"
                rows={3}
                placeholder="Add any relevant context, links, or details…"
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label
                htmlFor="task-priority"
                className="block text-[11px] font-medium text-zinc-600 uppercase tracking-widest"
              >
                Priority
              </label>
              <select
                id="task-priority"
                name="priority"
                defaultValue="medium"
                className={selectClass}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Start Date + Due Date — DatePicker row */}
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
                        rounded-md border border-zinc-200 bg-transparent
                        hover:border-zinc-300 transition-colors
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2
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
                  Due Date
                </p>
                <Popover open={dueOpen} onOpenChange={setDueOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="
                        w-full flex items-center gap-2 h-9 px-3 text-sm
                        rounded-md border border-zinc-200 bg-transparent
                        hover:border-zinc-300 transition-colors
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2
                      "
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
                      onSelect={(d) => { setDueDate(d); setDueOpen(false) }}
                      disabled={startDate ? { before: startDate } : undefined}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Assignee — Avatar-enhanced Select */}
            {hasMembers && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-600 uppercase tracking-widest">
                  Assignee
                </label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="h-9">
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
                    {members.map((m) => (
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
              </div>
            )}

            {/* Actions */}
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
