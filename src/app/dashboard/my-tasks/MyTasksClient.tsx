'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ClipboardList, ChevronDown, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, isPast, isToday } from 'date-fns'

interface Workspace {
  id: string
  name: string
}

interface TaskItem {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string | null
  workspace_id: string
  workspace: Workspace | null
}

interface Props {
  tasks: TaskItem[]
}

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-100',
  high:   'bg-orange-50 text-orange-700 border-orange-100',
  medium: 'bg-amber-50 text-amber-700 border-amber-100',
  low:    'bg-zinc-100 text-zinc-600 border-zinc-200',
}
const STATUS_STYLES: Record<string, string> = {
  todo:        'bg-zinc-100 text-zinc-600 border-zinc-200',
  pending:     'bg-zinc-100 text-zinc-600 border-zinc-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-100',
  review:      'bg-amber-50 text-amber-700 border-amber-100',
  done:        'bg-emerald-50 text-emerald-700 border-emerald-100',
}
const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do', pending: 'Pending', in_progress: 'In Progress', review: 'Review', done: 'Done',
}

type SortKey = 'priority' | 'due_date' | 'workspace'

export function MyTasksClient({ tasks: initialTasks }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('priority')

  const sorted = [...initialTasks].sort((a, b) => {
    if (sortBy === 'priority') {
      return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    }
    if (sortBy === 'due_date') {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    }
    // workspace
    const wa = a.workspace?.name ?? ''
    const wb = b.workspace?.name ?? ''
    return wa.localeCompare(wb)
  })

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white tracking-tight">My Tasks</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {initialTasks.length} task{initialTasks.length !== 1 ? 's' : ''} assigned to you across all workspaces.
          </p>
        </div>

        {/* Sort selector */}
        <div className="relative shrink-0">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="appearance-none h-8 pl-3 pr-8 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-[#1A1A1A] text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 cursor-pointer"
          >
            <option value="priority">Sort by Priority</option>
            <option value="due_date">Sort by Due Date</option>
            <option value="workspace">Sort by Client</option>
          </select>
          <ChevronDown size={12} strokeWidth={1.5} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        </div>
      </div>

      {initialTasks.length === 0 ? (
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center py-20 text-center gap-2">
          <ClipboardList size={28} strokeWidth={1} className="text-zinc-200 mb-2" />
          <p className="text-sm font-medium text-zinc-900 dark:text-white">No tasks assigned</p>
          <p className="text-sm text-zinc-400">Tasks assigned to you will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((task) => {
            const dueDateObj = task.due_date ? new Date(task.due_date) : null
            const overdue = dueDateObj && isPast(dueDateObj) && !isToday(dueDateObj) && task.status !== 'done'
            const dueToday = dueDateObj && isToday(dueDateObj)

            return (
              <Link
                key={task.id}
                href={`/dashboard/${task.workspace_id}`}
                className="block bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl px-5 py-4 flex items-start gap-4 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all cursor-pointer"
              >
                {/* Priority dot */}
                <div className={cn(
                  'shrink-0 w-2 h-2 rounded-full mt-2',
                  task.priority === 'urgent' ? 'bg-red-500' :
                  task.priority === 'high'   ? 'bg-orange-400' :
                  task.priority === 'medium' ? 'bg-amber-400' :
                  'bg-zinc-300'
                )} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <p className="text-sm font-medium text-black dark:text-white leading-snug">{task.title}</p>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 text-[10px] font-medium border rounded-full',
                        PRIORITY_STYLES[task.priority] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200'
                      )}>
                        {task.priority}
                      </span>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 text-[10px] font-medium border rounded-full',
                        STATUS_STYLES[task.status] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200'
                      )}>
                        {STATUS_LABELS[task.status] ?? task.status}
                      </span>
                    </div>
                  </div>

                  {task.description && (
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{task.description}</p>
                  )}

                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    {task.workspace && (
                      <span className="text-[11px] text-zinc-400">
                        {task.workspace.name}
                      </span>
                    )}
                    {dueDateObj && (
                      <span className={cn(
                        'text-[11px] font-medium',
                        overdue  ? 'text-red-600' :
                        dueToday ? 'text-amber-600' :
                        'text-zinc-400'
                      )}>
                        {overdue ? 'Overdue · ' : dueToday ? 'Due today · ' : 'Due '}
                        {format(dueDateObj, 'dd MMM yyyy')}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight size={14} strokeWidth={1.5} className="shrink-0 text-zinc-300 mt-1 self-center" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
