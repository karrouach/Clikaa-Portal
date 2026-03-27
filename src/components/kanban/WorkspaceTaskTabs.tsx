'use client'

import { useState, useEffect } from 'react'
import { LayoutGrid, List, Table2, GitBranch, Calendar, User } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { createBrowserClient } from '@supabase/ssr'
import { KanbanBoard, KANBAN_COLUMNS } from './KanbanBoard'
import { TaskDetailSheet } from './TaskDetailSheet'
import type { Task, TaskStatus } from '@/types/database'
import type { CurrentUserProfile } from './TaskDetailSheet'
import type { MemberOption } from './CreateTaskDialog'

// ─── Types ────────────────────────────────────────────────────────────────────
type ViewTab = 'board' | 'list' | 'table' | 'timeline'

const TABS: { id: ViewTab; label: string; icon: React.ElementType }[] = [
  { id: 'board',    label: 'Board',    icon: LayoutGrid },
  { id: 'list',     label: 'List',     icon: List       },
  { id: 'table',    label: 'Table',    icon: Table2     },
  { id: 'timeline', label: 'Timeline', icon: GitBranch  },
]

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_CHIP: Record<TaskStatus, string> = {
  todo:        'bg-zinc-100 text-zinc-600',
  pending:     'bg-amber-50 text-amber-700',
  in_progress: 'bg-blue-50 text-blue-700',
  review:      'bg-violet-50 text-violet-700',
  done:        'bg-emerald-50 text-emerald-700',
}

const STATUS_DOT: Record<TaskStatus, string> = {
  todo:        'bg-zinc-300',
  pending:     'bg-amber-400',
  in_progress: 'bg-blue-500',
  review:      'bg-violet-500',
  done:        'bg-emerald-500',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo:        'To Do',
  pending:     'Pending',
  in_progress: 'In Progress',
  review:      'Review',
  done:        'Done',
}

const PRIORITY_DOT: Record<string, string> = {
  low:    'bg-zinc-300',
  medium: 'bg-amber-400',
  high:   'bg-orange-500',
  urgent: 'bg-red-500',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  workspaceId: string
  workspaceName: string
  initialTasks: Task[]
  currentUserProfile: CurrentUserProfile
  workspaceMembers?: MemberOption[]
}

// ─── List View ────────────────────────────────────────────────────────────────
function ListView({
  tasks,
  members,
  onTaskClick,
}: {
  tasks: Task[]
  members: MemberOption[]
  onTaskClick: (t: Task) => void
}) {
  const grouped: Record<TaskStatus, Task[]> = {
    todo: [], pending: [], in_progress: [], review: [], done: [],
  }
  for (const t of tasks) {
    const s = t.status as TaskStatus
    if (grouped[s]) grouped[s].push(t)
  }

  return (
    <div className="px-4 md:px-6 py-5 space-y-5">
      {KANBAN_COLUMNS.map(({ id, label }) => {
        const col = grouped[id]
        if (col.length === 0) return null
        return (
          <div key={id}>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[id])} />
              <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">{label}</h3>
              <span className="text-[11px] text-zinc-400">({col.length})</span>
            </div>
            <div className="bg-white border border-zinc-100 rounded-xl divide-y divide-zinc-50 overflow-hidden">
              {col.map((task) => {
                const assignee = members.find((m) => m.id === task.assignee_id)
                return (
                  <button
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-50/60 transition-colors group"
                  >
                    <span
                      className={cn('shrink-0 w-2 h-2 rounded-full', PRIORITY_DOT[task.priority] ?? 'bg-zinc-300')}
                      title={task.priority}
                    />
                    <span className="flex-1 text-sm font-medium text-black truncate">{task.title}</span>
                    <span className={cn(
                      'shrink-0 hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full',
                      STATUS_CHIP[task.status as TaskStatus]
                    )}>
                      {STATUS_LABELS[task.status as TaskStatus]}
                    </span>
                    {assignee ? (
                      <div
                        className="shrink-0 w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center text-white text-[9px] font-semibold overflow-hidden"
                        title={assignee.full_name || assignee.email}
                      >
                        {assignee.avatar_url ? (
                          <img src={assignee.avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          getInitials(assignee.full_name || assignee.email)
                        )}
                      </div>
                    ) : (
                      <div className="shrink-0 w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center" title="Unassigned">
                        <User size={10} strokeWidth={1.5} className="text-zinc-400" />
                      </div>
                    )}
                    <span className="shrink-0 text-[11px] text-zinc-400 tabular-nums w-14 text-right hidden md:block">
                      {fmtDate(task.due_date)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      {tasks.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm text-zinc-400">No tasks yet. Create one on the Board.</p>
        </div>
      )}
    </div>
  )
}

// ─── Table View ───────────────────────────────────────────────────────────────
function TableView({
  tasks,
  members,
  onTaskClick,
}: {
  tasks: Task[]
  members: MemberOption[]
  onTaskClick: (t: Task) => void
}) {
  const sorted = [...tasks].sort((a, b) => {
    const sOrder: Record<TaskStatus, number> = { todo: 0, pending: 1, in_progress: 2, review: 3, done: 4 }
    return (sOrder[a.status as TaskStatus] ?? 5) - (sOrder[b.status as TaskStatus] ?? 5)
  })

  return (
    <div className="px-4 md:px-6 py-5">
      <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-4 py-3 w-4" />
                <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Task Name</th>
                <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap hidden md:table-cell">Priority</th>
                <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap hidden lg:table-cell">Assignee</th>
                <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap hidden lg:table-cell">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((task) => {
                const assignee = members.find((m) => m.id === task.assignee_id)
                return (
                  <tr
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3.5">
                      <span className={cn('block w-2 h-2 rounded-full', STATUS_DOT[task.status as TaskStatus])} />
                    </td>
                    <td className="px-4 py-3.5 font-medium text-black max-w-[200px] truncate">
                      {task.title}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full',
                        STATUS_CHIP[task.status as TaskStatus]
                      )}>
                        {STATUS_LABELS[task.status as TaskStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                        <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[task.priority] ?? 'bg-zinc-300')} />
                        <span className="capitalize">{task.priority}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      {assignee ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center text-white text-[9px] font-semibold shrink-0 overflow-hidden">
                            {assignee.avatar_url ? (
                              <img src={assignee.avatar_url} className="w-full h-full object-cover" alt="" />
                            ) : (
                              getInitials(assignee.full_name || assignee.email)
                            )}
                          </div>
                          <span className="text-xs text-zinc-600 truncate">{assignee.full_name || assignee.email}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-zinc-500 tabular-nums hidden lg:table-cell whitespace-nowrap">
                      {fmtDate(task.due_date)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-zinc-400">No tasks yet. Create one on the Board.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Timeline View ────────────────────────────────────────────────────────────
function TimelineView({
  tasks,
  members,
  onTaskClick,
}: {
  tasks: Task[]
  members: MemberOption[]
  onTaskClick: (t: Task) => void
}) {
  const today       = new Date().toISOString().slice(0, 10)
  const withDate    = [...tasks].filter((t) => t.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!))
  const withoutDate = tasks.filter((t) => !t.due_date)

  // Group into past, today, upcoming buckets by month
  const byMonth = new Map<string, Task[]>()
  for (const task of withDate) {
    const key = task.due_date!.slice(0, 7)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key)!.push(task)
  }

  function monthLabel(key: string) {
    const [y, m] = key.split('-')
    return new Date(+y, +m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="px-4 md:px-6 py-5 space-y-8">
      {byMonth.size === 0 && withoutDate.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm text-zinc-400">No tasks with due dates. Add due dates on the Board view.</p>
        </div>
      )}

      {Array.from(byMonth.entries()).map(([month, monthTasks]) => (
        <div key={month}>
          {/* Month header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
              <Calendar size={14} strokeWidth={1.5} className="text-white" />
            </div>
            <h3 className="text-sm font-semibold text-black">{monthLabel(month)}</h3>
            <div className="flex-1 h-px bg-zinc-100" />
            <span className="text-xs text-zinc-400">{monthTasks.length} task{monthTasks.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Timeline items */}
          <div className="relative ml-4 pl-5 border-l-2 border-zinc-100 space-y-2">
            {monthTasks.map((task) => {
              const assignee  = members.find((m) => m.id === task.assignee_id)
              const isOverdue = task.due_date && task.due_date < today && task.status !== 'done'
              const isToday   = task.due_date === today

              return (
                <button
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="relative w-full text-left bg-white border border-zinc-100 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-zinc-200 hover:bg-zinc-50/40 transition-colors group"
                >
                  {/* Timeline dot */}
                  <div className={cn(
                    'absolute -left-[1.65rem] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ring-2 ring-white shrink-0',
                    isOverdue ? 'bg-red-500' : isToday ? 'bg-black' : 'bg-zinc-300'
                  )} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-black truncate">{task.title}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {assignee?.full_name || assignee?.email || 'Unassigned'}
                    </p>
                  </div>

                  <span className={cn(
                    'shrink-0 hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full',
                    STATUS_CHIP[task.status as TaskStatus]
                  )}>
                    {STATUS_LABELS[task.status as TaskStatus]}
                  </span>

                  <span className={cn(
                    'shrink-0 text-[11px] tabular-nums whitespace-nowrap',
                    isOverdue ? 'text-red-500 font-semibold' : isToday ? 'text-black font-semibold' : 'text-zinc-400'
                  )}>
                    {isToday ? 'Today' : fmtDate(task.due_date)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Tasks without due dates */}
      {withoutDate.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
              <Calendar size={14} strokeWidth={1.5} className="text-zinc-400" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-500">No Due Date</h3>
            <div className="flex-1 h-px bg-zinc-100" />
            <span className="text-xs text-zinc-400">{withoutDate.length} task{withoutDate.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {withoutDate.map((task) => {
              const assignee = members.find((m) => m.id === task.assignee_id)
              return (
                <button
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="w-full text-left bg-white border border-zinc-100 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-zinc-200 hover:bg-zinc-50/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-black truncate">{task.title}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {assignee?.full_name || assignee?.email || 'Unassigned'}
                    </p>
                  </div>
                  <span className={cn(
                    'shrink-0 hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full',
                    STATUS_CHIP[task.status as TaskStatus]
                  )}>
                    {STATUS_LABELS[task.status as TaskStatus]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── WorkspaceTaskTabs ────────────────────────────────────────────────────────
export function WorkspaceTaskTabs({
  workspaceId,
  workspaceName,
  initialTasks,
  currentUserProfile,
  workspaceMembers = [],
}: Props) {
  const [activeTab,     setActiveTab]     = useState<ViewTab>('board')
  const [tasks,         setTasks]         = useState<Task[]>(initialTasks)
  const [selectedTask,  setSelectedTask]  = useState<Task | null>(null)
  const [isSheetOpen,   setIsSheetOpen]   = useState(false)

  // ── Realtime subscription — syncs List/Table/Timeline with DB ─────────────
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const channel = supabase
      .channel(`tabs:${workspaceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const inserted = payload.new as Task
          setTasks((prev) =>
            prev.some((t) => t.id === inserted.id) ? prev : [...prev, inserted]
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const updated = payload.new as Task
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
          setSelectedTask((prev) => (prev?.id === updated.id ? updated : prev))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id
          setTasks((prev) => prev.filter((t) => t.id !== deletedId))
          setSelectedTask((prev) => {
            if (prev?.id === deletedId) { setIsSheetOpen(false); return null }
            return prev
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [workspaceId])

  function handleTaskClick(task: Task) {
    setSelectedTask(task)
    setIsSheetOpen(true)
  }

  function handleTaskUpdated(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setSelectedTask(updated)
  }

  function handleTaskDeleted(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setIsSheetOpen(false)
    setSelectedTask(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── View tab bar ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 md:px-6 bg-white border-b border-zinc-100 flex items-end">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors duration-150 border-b-2 -mb-px whitespace-nowrap',
              activeTab === id
                ? 'text-black font-medium border-black'
                : 'text-zinc-400 border-transparent hover:text-zinc-700 hover:border-zinc-300'
            )}
          >
            <Icon size={13} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">

        {/* Board — always mounted to preserve its state + realtime + DnD */}
        <div
          className="flex-1 min-h-0 overflow-hidden"
          style={{ display: activeTab === 'board' ? 'flex' : 'none' }}
        >
          <KanbanBoard
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            initialTasks={initialTasks}
            currentUserProfile={currentUserProfile}
            workspaceMembers={workspaceMembers}
          />
        </div>

        {/* List / Table / Timeline — share tasks state from this component */}
        {activeTab !== 'board' && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50/30">
            {activeTab === 'list' && (
              <ListView tasks={tasks} members={workspaceMembers} onTaskClick={handleTaskClick} />
            )}
            {activeTab === 'table' && (
              <TableView tasks={tasks} members={workspaceMembers} onTaskClick={handleTaskClick} />
            )}
            {activeTab === 'timeline' && (
              <TimelineView tasks={tasks} members={workspaceMembers} onTaskClick={handleTaskClick} />
            )}
          </div>
        )}
      </div>

      {/* TaskDetailSheet for List / Table / Timeline (Board manages its own) */}
      {activeTab !== 'board' && (
        <TaskDetailSheet
          task={selectedTask}
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          currentUserProfile={currentUserProfile}
          onTaskUpdated={handleTaskUpdated}
          onTaskDeleted={handleTaskDeleted}
          workspaceMembers={workspaceMembers}
        />
      )}
    </div>
  )
}
