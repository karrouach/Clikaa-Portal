'use client'

import { useState, useTransition, useRef } from 'react'
import { Plus, Loader2, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { createTask } from '@/app/dashboard/task-actions'
import type { Task } from '@/types/database'

// ─── Field styles (matches the editorial bottom-border auth inputs) ────────
const fieldClass =
  'w-full bg-transparent text-sm text-black placeholder:text-zinc-400 ' +
  'border-0 border-b border-zinc-200 focus:outline-none focus:border-black ' +
  'transition-colors duration-150'

interface CreateTaskDialogProps {
  workspaceId: string
  onTaskCreated: (task: Task) => void
}

/**
 * CreateTaskDialog — floating dialog triggered by the "New Task" button.
 *
 * Form fields: Title (required), Description (optional), Priority (select).
 * Calls the `createTask` server action directly.
 * On success: injects the returned task into the board via onTaskCreated.
 */
export function CreateTaskDialog({ workspaceId, onTaskCreated }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleOpenChange(next: boolean) {
    if (!isPending) {
      setOpen(next)
      if (!next) {
        setError(null)
        formRef.current?.reset()
      }
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('workspace_id', workspaceId)
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

  return (
    <>
      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="
          flex items-center gap-1.5 h-9 px-4
          bg-black text-white text-sm font-medium
          hover:bg-zinc-800 active:bg-zinc-900
          transition-colors duration-150
        "
      >
        <Plus size={14} strokeWidth={1.5} />
        New Task
      </button>

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
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 text-red-700 text-sm">
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
              <input
                id="task-title"
                name="title"
                type="text"
                required
                autoFocus
                placeholder="What needs to be done?"
                className={`${fieldClass} h-9 py-1`}
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
              <textarea
                id="task-description"
                name="description"
                rows={3}
                placeholder="Add any relevant context, links, or details…"
                className={`${fieldClass} resize-none py-1`}
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
                className={`${fieldClass} h-9 cursor-pointer appearance-none`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

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
                  bg-black text-white text-sm font-medium
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
