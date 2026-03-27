'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { ApprovalActions } from './ApprovalActions'
import { TaskDetailSheet } from '@/components/kanban/TaskDetailSheet'
import type { Task } from '@/types/database'
import type { CurrentUserProfile } from '@/components/kanban/TaskDetailSheet'

// ── Types ─────────────────────────────────────────────────────────────────────
// Must include all fields TaskDetailSheet needs
export interface ReviewTask {
  id: string
  title: string
  status: string
  priority: string
  description: string | null
  due_date: string | null
  start_date: string | null
  workspace_id: string
  assignee_id: string | null
  created_at: string
  updated_at: string
}

interface Props {
  initialTasks: ReviewTask[]
  currentUserProfile: CurrentUserProfile
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function NeedsApprovalPanel({ initialTasks, currentUserProfile }: Props) {
  const [tasks, setTasks]             = useState(initialTasks)
  const [openTask, setOpenTask]       = useState<ReviewTask | null>(null)

  function handleRemove(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    if (openTask?.id === id) setOpenTask(null)
  }

  // When TaskDetailSheet updates a task (status change from inside the sheet)
  function handleTaskUpdated(updated: Task) {
    setTasks((prev) =>
      prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t)
        .filter((t) => t.status === 'review') // remove if no longer in review
    )
    if (updated.status !== 'review') setOpenTask(null)
  }

  function handleTaskDeleted(taskId: string) {
    handleRemove(taskId)
  }

  if (tasks.length === 0) {
    return (
      <div className="px-5 py-10 flex flex-col items-center text-center gap-2">
        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center mb-1">
          <span className="text-emerald-600 text-base">✓</span>
        </div>
        <p className="text-sm text-zinc-500">You're all caught up!</p>
        <p className="text-xs text-zinc-300">No items pending your review.</p>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="px-5 py-4 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer group/card"
            onClick={(e) => {
              // Don't open sheet if clicking the action buttons
              if ((e.target as HTMLElement).closest('button, [role="button"]')) return
              setOpenTask(task)
            }}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center mt-0.5">
                <FileText size={13} strokeWidth={1.5} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black dark:text-white leading-snug group-hover/card:text-zinc-700 dark:group-hover/card:text-zinc-200 transition-colors">
                  {task.title}
                </p>
                {task.due_date && (
                  <p className="text-xs text-zinc-400 mt-0.5">Due {formatDate(task.due_date)}</p>
                )}
                <ApprovalActions taskId={task.id} taskTitle={task.title} onRemove={handleRemove} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Task detail sheet */}
      <TaskDetailSheet
        task={openTask as Task | null}
        open={!!openTask}
        onOpenChange={(v) => { if (!v) setOpenTask(null) }}
        currentUserProfile={currentUserProfile}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
        workspaceMembers={[]}
      />
    </>
  )
}
