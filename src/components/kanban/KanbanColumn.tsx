'use client'

import { Droppable } from '@hello-pangea/dnd'
import type { Task, TaskStatus } from '@/types/database'
import { KanbanCard } from './KanbanCard'
import { cn } from '@/lib/utils'

interface KanbanColumnProps {
  columnId: TaskStatus
  label: string
  dotClass: string
  tasks: Task[]
  onCardClick?: (task: Task) => void
}

/**
 * KanbanColumn — a single status column on the board.
 *
 * Wraps @hello-pangea/dnd's Droppable, which:
 *  - Accepts dropped Draggable cards from any column.
 *  - Signals active drop zones via snapshot.isDraggingOver.
 *  - Injects placeholder space while a card is being dragged.
 */
export function KanbanColumn({ columnId, label, dotClass, tasks, onCardClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-72 shrink-0 max-h-full">
      {/* ── Column header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotClass)} />
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
            {label}
          </span>
        </div>
        {tasks.length > 0 && (
          <span className="text-xs text-zinc-400 tabular-nums">{tasks.length}</span>
        )}
      </div>

      {/* ── Droppable area ────────────────────────────────────────────── */}
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              // Base column body
              'flex-1 overflow-y-auto rounded-sm p-2 space-y-2 transition-colors duration-150',
              // Resting state
              'bg-zinc-50',
              // Active drop target — subtle highlight so the user sees where the card will land
              snapshot.isDraggingOver && 'bg-zinc-100 ring-1 ring-inset ring-zinc-200',
              // Ensure empty columns are droppable
              'min-h-[120px]'
            )}
          >
            {tasks.map((task, index) => (
              <KanbanCard
                key={task.id}
                task={task}
                index={index}
                onClick={onCardClick}
              />
            ))}

            {/* Placeholder preserves column height during drag */}
            {provided.placeholder}

            {/* ── Empty state ────────────────────────────────────────── */}
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center h-24 text-xs text-zinc-400">
                Drop cards here
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  )
}
