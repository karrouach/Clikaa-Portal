import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Calendar' }

// ─── Status colour map ────────────────────────────────────────────────────────
const STATUS_CHIP: Record<string, string> = {
  todo:        'bg-zinc-100   text-zinc-600',
  in_progress: 'bg-blue-50    text-blue-700',
  review:      'bg-violet-50  text-violet-700',
  done:        'bg-emerald-50 text-emerald-700',
}

const STATUS_DOT: Record<string, string> = {
  todo:        'bg-zinc-300',
  in_progress: 'bg-blue-400',
  review:      'bg-violet-400',
  done:        'bg-emerald-400',
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate() // month is 1-indexed
}

function firstWeekdayOfMonth(year: number, month: number) {
  // 0 = Sunday ... 6 = Saturday → convert to Monday-first (0 = Mon … 6 = Sun)
  const day = new Date(year, month - 1, 1).getDay()
  return (day + 6) % 7
}

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

function nextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

function padDate(n: number) {
  return String(n).padStart(2, '0')
}

// ─── Page ─────────────────────────────────────────────────────────────────────
interface Props {
  searchParams: Promise<{ month?: string; year?: string }>
}

export default async function CalendarPage({ searchParams }: Props) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Resolve current month from searchParams ─────────────────────────────
  const params = await searchParams
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${padDate(today.getMonth() + 1)}-${padDate(today.getDate())}`

  const year  = Number(params.year)  || today.getFullYear()
  const month = Number(params.month) || today.getMonth() + 1 // 1-indexed

  const totalDays = daysInMonth(year, month)
  const offset    = firstWeekdayOfMonth(year, month)

  // Date range for the DB query (inclusive)
  const rangeStart = `${year}-${padDate(month)}-01`
  const rangeEnd   = `${year}-${padDate(month)}-${padDate(totalDays)}`

  // ── Fetch tasks with due_date in this month ─────────────────────────────
  // Admin RLS allows fetching across all workspaces.
  const { data: rawTasks } = await supabase
    .from('tasks')
    .select('id, title, status, due_date, workspace_id, workspaces(name)')
    .not('due_date', 'is', null)
    .gte('due_date', rangeStart)
    .lte('due_date', rangeEnd)
    .order('due_date', { ascending: true })

  type CalendarTask = {
    id: string
    title: string
    status: string
    due_date: string
    workspace_id: string
    workspaceName: string
  }

  // Flatten and normalise
  const tasks: CalendarTask[] = (rawTasks ?? []).map((t) => ({
    id:            t.id,
    title:         t.title,
    status:        t.status,
    due_date:      t.due_date!,
    workspace_id:  t.workspace_id,
    workspaceName: (t.workspaces as { name: string } | null)?.name ?? 'Unknown',
  }))

  // Group by date string (YYYY-MM-DD)
  const byDate: Record<string, CalendarTask[]> = {}
  for (const task of tasks) {
    if (!byDate[task.due_date]) byDate[task.due_date] = []
    byDate[task.due_date].push(task)
  }

  // ── Navigation URLs ──────────────────────────────────────────────────────
  const prev = prevMonth(year, month)
  const next = nextMonth(year, month)

  const prevHref = `/dashboard/calendar?year=${prev.year}&month=${prev.month}`
  const nextHref = `/dashboard/calendar?year=${next.year}&month=${next.month}`

  // ── Build calendar cells ─────────────────────────────────────────────────
  type Cell = { day: number | null; dateStr: string | null; tasks: CalendarTask[] }
  const cells: Cell[] = []

  // Empty prefix cells
  for (let i = 0; i < offset; i++) cells.push({ day: null, dateStr: null, tasks: [] })

  // Day cells
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${padDate(month)}-${padDate(d)}`
    cells.push({ day: d, dateStr, tasks: byDate[dateStr] ?? [] })
  }

  // Pad to complete the final row
  while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: null, tasks: [] })

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Tasks with due dates across all workspaces.
          </p>
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-3">
          <Link
            href={prevHref}
            className="flex items-center justify-center w-8 h-8 border border-zinc-200 text-zinc-500 hover:text-black hover:border-zinc-300 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={14} strokeWidth={1.5} />
          </Link>

          <span className="text-sm font-medium text-black tabular-nums min-w-[120px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>

          <Link
            href={nextHref}
            className="flex items-center justify-center w-8 h-8 border border-zinc-200 text-zinc-500 hover:text-black hover:border-zinc-300 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-4 flex-wrap">
        {Object.entries(STATUS_DOT).map(([status, dotClass]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} />
            <span className="text-xs text-zinc-400 capitalize">
              {status.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>

      {/* ── Calendar grid ──────────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-100 overflow-hidden">

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-zinc-100">
          {DAY_LABELS.map((day) => (
            <div
              key={day}
              className="px-3 py-2 text-[10px] font-medium text-zinc-400 uppercase tracking-widest text-center border-r border-zinc-100 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const isToday = cell.dateStr === todayStr
            const isWeekend = i % 7 >= 5 // Sat, Sun (Mon-first offset)

            return (
              <div
                key={i}
                className={cn(
                  'min-h-[100px] p-2 border-b border-r border-zinc-100',
                  'last-of-type:border-r-0',
                  // Remove right border on every 7th cell
                  (i + 1) % 7 === 0 && 'border-r-0',
                  // Remove bottom border on last row cells
                  i >= cells.length - 7 && 'border-b-0',
                  // Weekends: very subtle tint
                  isWeekend && cell.day && 'bg-zinc-50/40',
                  // Empty overflow cells
                  !cell.day && 'bg-zinc-50/20',
                )}
              >
                {cell.day !== null && (
                  <>
                    {/* Day number */}
                    <div
                      className={cn(
                        'inline-flex items-center justify-center w-6 h-6 text-xs font-medium mb-1.5',
                        isToday
                          ? 'bg-black text-white rounded-full'
                          : 'text-zinc-400'
                      )}
                    >
                      {cell.day}
                    </div>

                    {/* Task chips */}
                    <div className="space-y-0.5">
                      {cell.tasks.slice(0, 3).map((task) => (
                        <Link
                          key={task.id}
                          href={`/dashboard/${task.workspace_id}`}
                          title={`${task.title} — ${task.workspaceName}`}
                          className={cn(
                            'flex items-center gap-1 px-1.5 py-0.5 text-[11px] leading-tight truncate',
                            'rounded-sm transition-opacity hover:opacity-80 block',
                            STATUS_CHIP[task.status] ?? 'bg-zinc-100 text-zinc-600'
                          )}
                        >
                          <span
                            className={cn('shrink-0 w-1.5 h-1.5 rounded-full', STATUS_DOT[task.status])}
                          />
                          <span className="truncate">{task.title}</span>
                        </Link>
                      ))}

                      {/* Overflow indicator */}
                      {cell.tasks.length > 3 && (
                        <p className="px-1.5 text-[10px] text-zinc-400">
                          +{cell.tasks.length - 3} more
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Empty state (no tasks this month) ──────────────────────────── */}
      {tasks.length === 0 && (
        <div className="mt-6 flex flex-col items-center justify-center py-12 text-center">
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
            <CalendarDays size={18} strokeWidth={1.5} className="text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-900">No tasks due in {MONTH_NAMES[month - 1]}</p>
          <p className="text-xs text-zinc-400 mt-1">
            Add due dates to tasks on the board to see them here.
          </p>
        </div>
      )}

    </div>
  )
}
