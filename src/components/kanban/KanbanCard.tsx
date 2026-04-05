'use client'

import { memo } from 'react'
import { Draggable, type DraggableProvided, type DraggableStateSnapshot } from '@hello-pangea/dnd'
import type { Task, TaskPriority } from '@/types/database'
import { Calendar, Paperclip, MessageSquare, Flag } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import type { MemberOption } from './CreateTaskDialog'

// ─── Props ────────────────────────────────────────────────────────────────────

interface KanbanCardProps {
  task: Task
  index: number
  onClick?: (task: Task) => void
  members?: MemberOption[]
}

// ─── Priority config (Flag icon style) ───────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; label: string }> = {
  urgent: { color: 'text-red-500 dark:text-red-400',         label: 'High'   }, // legacy: treat urgent as High
  high:   { color: 'text-red-500 dark:text-red-400',         label: 'High'   },
  medium: { color: 'text-amber-500 dark:text-amber-400',     label: 'Medium' },
  low:    { color: 'text-emerald-500 dark:text-emerald-400', label: 'Low'    },
}

// ─── Due date helper ──────────────────────────────────────────────────────────

function daysUntil(dueDate: string | null): { text: string; overdue: boolean } | null {
  if (!dueDate) return null
  const due = new Date(dueDate + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0)  return { text: `${Math.abs(diff)}d overdue`, overdue: true }
  if (diff === 0) return { text: 'Due today',                  overdue: false }
  if (diff === 1) return { text: '1 day left',                 overdue: false }
  return             { text: `${diff}d left`,                  overdue: false }
}

// ─── Figma SVG icon ───────────────────────────────────────────────────────────

function FigmaIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 28.5A9.5 9.5 0 1 1 38 28.5A9.5 9.5 0 1 1 19 28.5Z" fill="#1ABCFE"/>
      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19V57H9.5A9.5 9.5 0 0 1 0 47.5Z" fill="#0ACF83"/>
      <path d="M19 0L9.5 0A9.5 9.5 0 0 0 0 9.5A9.5 9.5 0 0 0 9.5 19H19V0Z" fill="#F24E1E"/>
      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#A259FF"/>
      <path d="M38 9.5A9.5 9.5 0 0 0 28.5 0H19V19H28.5A9.5 9.5 0 0 0 38 9.5Z" fill="#FF7262"/>
    </svg>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * KanbanCard — individual task card, wrapped in @hello-pangea/dnd Draggable.
 *
 * Performance notes:
 * - Wrapped in React.memo to prevent re-renders when sibling cards move.
 * - Uses targeted CSS transitions (shadow + border) instead of transition-all
 *   to avoid painting all properties on every frame during drag.
 * - will-change: transform is applied during drag to promote the card to its
 *   own compositor layer, enabling GPU-accelerated movement.
 */
export const KanbanCard = memo(function KanbanCard({ task, index, onClick, members }: KanbanCardProps) {
  const priority = PRIORITY_CONFIG[task.priority]
  const due = daysUntil(task.due_date)
  const assignee = members?.find((m) => m.id === task.assignee_id)
  const creator  = members?.find((m) => m.id === task.created_by)

  // Build deduplicated avatar list: creator first, then assignee (if different)
  const avatars: MemberOption[] = []
  if (creator)  avatars.push(creator)
  if (assignee && assignee.id !== creator?.id) avatars.push(assignee)

  const hasFigmaLink   = (task.links ?? []).some((l) => l.includes('figma.com'))
  const linkCount      = task.links?.length ?? 0
  const commentCount   = task.comment_count ?? 0

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick?.(task)}
          style={{
            ...provided.draggableProps.style,
            willChange: snapshot.isDragging ? 'transform' : 'auto',
          }}
          className={cn(
            'relative bg-white dark:bg-zinc-900 border border-gray-200/75 dark:border-zinc-800/75 rounded-xl p-3.5 select-none shadow-sm m-px',
            'transition-[box-shadow,border-color,opacity,transform] duration-150',
            onClick ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
            !snapshot.isDragging && 'hover:z-10 hover:border-gray-300 dark:hover:border-zinc-700 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]',
            snapshot.isDragging && 'z-50 border-gray-300 dark:border-zinc-700 shadow-xl rotate-[1deg] scale-[1.02] opacity-95',
          )}
        >
          {/* ── Priority flag ────────────────────────────────────────────── */}
          <div className={cn('flex items-center gap-1.5 text-xs font-medium mb-2.5', priority.color)}>
            <Flag size={12} strokeWidth={2} className="shrink-0" />
            {priority.label}
          </div>

          {/* ── Title ───────────────────────────────────────────────────── */}
          <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug break-words">
            {task.title}
          </p>

          {/* ── Description ─────────────────────────────────────────────── */}
          {task.description && (
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
              {task.description.replace(/<[^>]+>/g, '')}
            </p>
          )}

          {/* ── Figma badge — below description, above footer ───────────── */}
          {hasFigmaLink && (
            <div className="flex items-center gap-1.5 w-max px-2.5 py-1 mt-3 bg-gray-100 dark:bg-zinc-800 rounded-full text-xs font-medium text-gray-700 dark:text-zinc-300">
              <FigmaIcon />
              Figma
            </div>
          )}

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800/50 flex items-center justify-between gap-2">

            {/* Avatar group — creator + assignee, forced circular */}
            <div className="flex items-center shrink-0">
              {avatars.length > 0 ? (
                <div className="flex -space-x-1.5">
                  {avatars.map((m) => (
                    m.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={m.id}
                        src={m.avatar_url}
                        alt={m.full_name || m.email}
                        className="w-6 h-6 rounded-full object-cover border-2 border-white dark:border-zinc-900"
                      />
                    ) : (
                      <div
                        key={m.id}
                        className="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0"
                      >
                        <span className="text-[8px] font-medium text-zinc-600 dark:text-zinc-300 leading-none">
                          {getInitials(m.full_name || m.email)}
                        </span>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                  <span className="text-[8px] text-gray-400">?</span>
                </div>
              )}
            </div>

            {/* Right side: link count + comment count + due date */}
            <div className="flex items-center gap-3 shrink-0">
              {linkCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-zinc-500">
                  <Paperclip size={10} strokeWidth={1.5} />
                  {linkCount}
                </span>
              )}
              {commentCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-zinc-500">
                  <MessageSquare size={10} strokeWidth={1.5} />
                  {commentCount}
                </span>
              )}
              {due && (
                <span className={cn(
                  'flex items-center gap-1 text-[11px]',
                  due.overdue ? 'text-red-500' : 'text-gray-400 dark:text-zinc-500',
                )}>
                  <Calendar size={10} strokeWidth={1.5} />
                  {due.text}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  )
})
