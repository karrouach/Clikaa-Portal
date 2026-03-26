'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { ApprovalActions } from './ApprovalActions'

interface Task {
  id: string
  title: string
  due_date: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function NeedsApprovalPanel({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks)

  function handleRemove(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
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
    <div className="divide-y divide-zinc-50">
      {tasks.map((task) => (
        <div key={task.id} className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center mt-0.5">
              <FileText size={13} strokeWidth={1.5} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-black leading-snug">{task.title}</p>
              {task.due_date && (
                <p className="text-xs text-zinc-400 mt-0.5">Due {formatDate(task.due_date)}</p>
              )}
              <ApprovalActions taskId={task.id} taskTitle={task.title} onRemove={handleRemove} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
