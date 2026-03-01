'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { updateTaskPosition } from '@/app/dashboard/task-actions'
import type { Task, TaskStatus } from '@/types/database'
import type { CurrentUserProfile } from './TaskDetailSheet'
import { KanbanColumn } from './KanbanColumn'
import { CreateTaskDialog } from './CreateTaskDialog'
import { TaskDetailSheet } from './TaskDetailSheet'

// ─── Column definitions ────────────────────────────────────────────────────
export const KANBAN_COLUMNS: {
  id: TaskStatus
  label: string
  dotClass: string
}[] = [
  { id: 'todo', label: 'To Do', dotClass: 'bg-zinc-400' },
  { id: 'in_progress', label: 'In Progress', dotClass: 'bg-blue-500' },
  { id: 'review', label: 'Review', dotClass: 'bg-violet-500' },
  { id: 'done', label: 'Done', dotClass: 'bg-emerald-500' },
]

// ─── Fractional-index position calculator ─────────────────────────────────
function calcPosition(
  prevPos: number | null | undefined,
  nextPos: number | null | undefined
): number {
  const prev = prevPos ?? null
  const next = nextPos ?? null

  if (prev === null && next === null) return 1.0   // First card in column
  if (prev === null) return next! / 2              // Insert at top
  if (next === null) return prev + 1.0             // Insert at bottom
  return (prev + next) / 2                         // Insert between two cards
}

// ─── Props ────────────────────────────────────────────────────────────────
interface KanbanBoardProps {
  workspaceId: string
  workspaceName: string
  initialTasks: Task[]
  currentUserProfile: CurrentUserProfile
}

// ─────────────────────────────────────────────────────────────────────────────
// KanbanBoard — the root client component for the entire board view.
//
// Responsibilities:
//   1. Owns the authoritative task list in React state.
//   2. Groups + sorts tasks by column for rendering.
//   3. Manages drag-and-drop via @hello-pangea/dnd (optimistic updates).
//   4. Holds a live Supabase Realtime subscription for multi-user sync.
//   5. Exposes task-creation via <CreateTaskDialog />.
//   6. Manages the <TaskDetailSheet /> for full task detail + comments.
// ─────────────────────────────────────────────────────────────────────────────
export function KanbanBoard({
  workspaceId,
  workspaceName,
  initialTasks,
  currentUserProfile,
}: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)

  // ── Task detail sheet state ────────────────────────────────────────────
  // selectedTask stays set during the sheet's close animation so the content
  // doesn't disappear before the slide-out transition finishes.
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  // Suppress realtime updates while a drag is in flight to avoid
  // flickering caused by the incoming DB event overriding the optimistic state.
  const isDraggingRef = useRef(false)

  // ── Group + sort tasks by status (memoised) ────────────────────────────
  const sortedByStatus = useMemo<Record<TaskStatus, Task[]>>(() => {
    const groups: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    }
    for (const task of tasks) {
      groups[task.status].push(task)
    }
    for (const key of Object.keys(groups) as TaskStatus[]) {
      groups[key].sort((a, b) => a.position - b.position)
    }
    return groups
  }, [tasks])

  // ── Supabase Realtime subscription ─────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`workspace:${workspaceId}:tasks`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          // Skip while user is actively dragging — optimistic state is king.
          if (isDraggingRef.current) return

          if (payload.eventType === 'INSERT') {
            const incoming = payload.new as Task
            setTasks((prev) => {
              if (prev.some((t) => t.id === incoming.id)) return prev
              return [...prev, incoming]
            })
          } else if (payload.eventType === 'UPDATE') {
            const incoming = payload.new as Task
            setTasks((prev) =>
              prev.map((t) => (t.id === incoming.id ? incoming : t))
            )
            // Keep the sheet in sync if the updated task is currently open
            setSelectedTask((prev) =>
              prev?.id === incoming.id ? incoming : prev
            )
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            setTasks((prev) => prev.filter((t) => t.id !== deletedId))
            // Close the sheet if the open task was deleted by another user
            setSelectedTask((prev) => {
              if (prev?.id === deletedId) {
                setIsSheetOpen(false)
                return null
              }
              return prev
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId])

  // ── DnD handlers ──────────────────────────────────────────────────────
  const onDragStart = useCallback(() => {
    isDraggingRef.current = true
  }, [])

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      isDraggingRef.current = false

      const { draggableId, source, destination } = result

      if (!destination) return

      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      )
        return

      const destStatus = destination.droppableId as TaskStatus

      const destTasks = sortedByStatus[destStatus].filter(
        (t) => t.id !== draggableId
      )

      const prevPos = destTasks[destination.index - 1]?.position
      const nextPos = destTasks[destination.index]?.position
      const newPosition = calcPosition(prevPos, nextPos)

      // ── 1. Optimistic update ─────────────────────────────────────────────
      const updatedTask = { status: destStatus, position: newPosition }
      setTasks((prev) =>
        prev.map((t) =>
          t.id === draggableId ? { ...t, ...updatedTask } : t
        )
      )
      // Keep sheet in sync if the dragged task is currently open
      setSelectedTask((prev) =>
        prev?.id === draggableId ? { ...prev, ...updatedTask } : prev
      )

      // ── 2. Persist in background ─────────────────────────────────────────
      const { error } = await updateTaskPosition({
        taskId: draggableId,
        status: destStatus,
        position: newPosition,
      })

      if (error) {
        console.error('[Kanban] Failed to persist drag:', error)
      }
    },
    [sortedByStatus]
  )

  // ── Task creation callback ─────────────────────────────────────────────
  const handleTaskCreated = useCallback((task: Task) => {
    setTasks((prev) => {
      if (prev.some((t) => t.id === task.id)) return prev
      return [...prev, task]
    })
  }, [])

  // ── Card click → open task detail sheet ───────────────────────────────
  const handleCardClick = useCallback((task: Task) => {
    setSelectedTask(task)
    setIsSheetOpen(true)
  }, [])

  // ── Task updated from sheet (optimistic status, title, description) ───
  const handleTaskUpdated = useCallback((updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setSelectedTask(updated)
  }, [])

  // ── Task deleted from sheet ────────────────────────────────────────────
  const handleTaskDeleted = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setIsSheetOpen(false)
    // selectedTask stays set for the close animation, cleared on next open
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col h-full">
        {/* ── Board header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-100 shrink-0">
          <div>
            <h1 className="text-base font-semibold text-black tracking-tight">
              {workspaceName}
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </p>
          </div>

          <CreateTaskDialog
            workspaceId={workspaceId}
            onTaskCreated={handleTaskCreated}
          />
        </div>

        {/* ── Columns ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6 snap-x snap-mandatory md:snap-none">
          <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="flex gap-4 h-full">
              {KANBAN_COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  columnId={col.id}
                  label={col.label}
                  dotClass={col.dotClass}
                  tasks={sortedByStatus[col.id]}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>
          </DragDropContext>
        </div>
      </div>

      {/* ── Task detail sheet — always mounted, open controlled by state ── */}
      <TaskDetailSheet
        task={selectedTask}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        currentUserProfile={currentUserProfile}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />
    </>
  )
}
