'use client'

import { Draggable, type DraggableProvided, type DraggableStateSnapshot } from '@hello-pangea/dnd'
import type { Task, TaskPriority } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { cn, formatRelativeTime } from '@/lib/utils'
import { Calendar } from 'lucide-react'

interface KanbanCardProps {
  task: Task
  index: number
  /**
   * onClick is wired up in Phase 4 to open the TaskDetailSheet.
   * Optional so the card remains self-contained in Phase 3.
   */
  onClick?: (task: Task) => void
}

// Priority badge variant map — keeps the card decoupled from the Badge internals
const priorityVariant: Record<TaskPriority, 'low' | 'medium' | 'high' | 'urgent'> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent',
}

/**
 * KanbanCard — individual task card, wrapped in @hello-pangea/dnd Draggable.
 *
 * The entire card surface acts as the drag handle for a simple, accessible UX.
 * On drag: slight rotation + elevation to give a "lifted" physical feel.
 */
export function KanbanCard({ task, index, onClick }: KanbanCardProps) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick?.(task)}
          className={cn(
            // Base
            'bg-white border border-zinc-100 p-3.5 select-none',
            'transition-all duration-150',
            // Cursor
            onClick ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
            // Resting hover — barely perceptible lift
            !snapshot.isDragging && 'hover:border-zinc-200 hover:shadow-sm',
            // Active drag — elevated with slight rotation for tactile feel
            snapshot.isDragging &&
              'border-zinc-200 shadow-xl !rotate-[1deg] !scale-[1.02] opacity-95'
          )}
        >
          {/* ── Title ──────────────────────────────────────────────────── */}
          <p className="text-sm font-medium text-black leading-snug break-words">
            {task.title}
          </p>

          {/* ── Description preview ─────────────────────────────────────── */}
          {task.description && (
            <p className="mt-1.5 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* ── Footer: priority + date ──────────────────────────────────── */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <Badge variant={priorityVariant[task.priority]} className="shrink-0">
              {task.priority}
            </Badge>

            <span className="flex items-center gap-1 text-[11px] text-zinc-400 shrink-0">
              <Calendar size={10} strokeWidth={1.5} />
              {formatRelativeTime(task.created_at)}
            </span>
          </div>
        </div>
      )}
    </Draggable>
  )
}
