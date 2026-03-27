import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Calendar' }

// ─── Status colour maps ───────────────────────────────────────────────────────
const STATUS_CHIP: Record<string, string> = {
  todo:        'bg-zinc-100   text-zinc-600',
  pending:     'bg-amber-50   text-amber-700',
  in_progress: 'bg-blue-50    text-blue-700',
  review:      'bg-violet-50  text-violet-700',
  done:        'bg-emerald-50 text-emerald-700',
}

const STATUS_DOT: Record<string, string> = {
  todo:        'bg-zinc-300',
  pending:     'bg-amber-400',
  in_progress: 'bg-blue-400',
  review:      'bg-violet-400',
  done:        'bg-emerald-400',
}

const DAY_LABELS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES  = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ─── Date helpers ─────────────────────────────────────────────────────────────
function daysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate() }

function firstWeekdayOfMonth(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay()
  return (day + 6) % 7 // Mon = 0 … Sun = 6
}

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}
function nextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

function padDate(n: number) { return String(n).padStart(2, '0') }

/** Return the ISO date string (YYYY-MM-DD) of the Monday on or before `date`. */
function getWeekMonday(date: Date): string {
  const d = new Date(date)
  const dow = d.getDay() // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function formatWeekDay(iso: string): { label: string; day: number } {
  const d = new Date(iso + 'T00:00:00')
  return {
    label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    day: d.getDate(),
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
type CalendarTask = {
  id: string
  title: string
  status: string
  start_date: string | null
  due_date: string | null
  workspace_id: string
  workspaceName: string
}

// ─── Shared: build byDate map ─────────────────────────────────────────────────
function buildByDate(tasks: CalendarTask[], rangeStart: string, rangeEnd: string): Record<string, CalendarTask[]> {
  const byDate: Record<string, CalendarTask[]> = {}
  for (const task of tasks) {
    const spanStart = task.start_date ?? task.due_date
    const spanEnd   = task.due_date   ?? task.start_date
    if (!spanStart || !spanEnd) continue

    const clampedStart = spanStart < rangeStart ? rangeStart : spanStart
    const clampedEnd   = spanEnd   > rangeEnd   ? rangeEnd   : spanEnd

    const cur = new Date(clampedStart + 'T00:00:00')
    const end = new Date(clampedEnd   + 'T00:00:00')
    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10)
      if (!byDate[ds]) byDate[ds] = []
      if (!byDate[ds].some((t) => t.id === task.id)) byDate[ds].push(task)
      cur.setDate(cur.getDate() + 1)
    }
  }
  return byDate
}

// ─── Page ─────────────────────────────────────────────────────────────────────
interface Props {
  searchParams: Promise<{ month?: string; year?: string; view?: string; weekStart?: string }>
}

export default async function CalendarPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params   = await searchParams
  const today    = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const view     = params.view === 'week' ? 'week' : 'month'

  // ── Week view ───────────────────────────────────────────────────────────────
  if (view === 'week') {
    const weekStart = params.weekStart ?? getWeekMonday(today)
    const weekEnd   = addDays(weekStart, 6)

    const { data: rawTasks } = await supabase
      .from('tasks')
      .select('id, title, status, start_date, due_date, workspace_id, workspaces(name)')
      .or([
        `and(due_date.gte.${weekStart},due_date.lte.${weekEnd})`,
        `and(start_date.gte.${weekStart},start_date.lte.${weekEnd})`,
        `and(start_date.lte.${weekStart},due_date.gte.${weekEnd})`,
      ].join(','))
      .order('due_date', { ascending: true, nullsFirst: false })

    const tasks: CalendarTask[] = (rawTasks ?? []).map((t) => ({
      id:            t.id,
      title:         t.title,
      status:        t.status,
      start_date:    t.start_date ?? null,
      due_date:      t.due_date ?? null,
      workspace_id:  t.workspace_id,
      workspaceName: (t.workspaces as { name: string } | null)?.name ?? '',
    }))

    const byDate = buildByDate(tasks, weekStart, weekEnd)

    const days = Array.from({ length: 7 }, (_, i) => {
      const ds = addDays(weekStart, i)
      return { dateStr: ds, ...formatWeekDay(ds), tasks: byDate[ds] ?? [] }
    })

    const prevWeekStart = addDays(weekStart, -7)
    const nextWeekStart = addDays(weekStart, 7)

    const weekLabel = (() => {
      const s = new Date(weekStart + 'T00:00:00')
      const e = new Date(weekEnd   + 'T00:00:00')
      const sLabel = s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      const eLabel = e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      return `${sLabel} – ${eLabel}`
    })()

    const monthViewHref = `/dashboard/calendar?view=month&year=${today.getFullYear()}&month=${today.getMonth() + 1}`

    return (
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-black tracking-tight">Calendar</h1>
            <p className="mt-1 text-sm text-zinc-500">Tasks across all workspaces.</p>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden h-8">
              <Link href={monthViewHref} className="px-3 h-full flex items-center text-xs text-zinc-500 hover:bg-zinc-50 transition-colors">Month</Link>
              <span className="w-px h-4 bg-zinc-200" />
              <span className="px-3 h-full flex items-center text-xs font-medium bg-black text-white">Week</span>
            </div>

            {/* Week navigation */}
            <Link href={`/dashboard/calendar?view=week&weekStart=${prevWeekStart}`} className="flex items-center justify-center w-8 h-8 border border-zinc-200 text-zinc-500 hover:text-black hover:border-zinc-300 transition-colors rounded-lg">
              <ChevronLeft size={14} strokeWidth={1.5} />
            </Link>
            <span className="text-sm font-medium text-black tabular-nums whitespace-nowrap">{weekLabel}</span>
            <Link href={`/dashboard/calendar?view=week&weekStart=${nextWeekStart}`} className="flex items-center justify-center w-8 h-8 border border-zinc-200 text-zinc-500 hover:text-black hover:border-zinc-300 transition-colors rounded-lg">
              <ChevronRight size={14} strokeWidth={1.5} />
            </Link>
          </div>
        </div>

        {/* Status legend */}
        <div className="mb-4 flex items-center gap-4 flex-wrap">
          {Object.entries(STATUS_DOT).map(([status, dotClass]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} />
              <span className="text-xs text-zinc-400 capitalize">{status.replace('_', ' ')}</span>
            </div>
          ))}
        </div>

        {/* Week grid */}
        <div className="bg-white border border-zinc-100 overflow-hidden rounded-xl">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-zinc-100">
            {days.map(({ label, day, dateStr }) => {
              const isToday = dateStr === todayStr
              return (
                <div key={dateStr} className={cn(
                  'px-3 py-3 text-center border-r border-zinc-100 last:border-r-0',
                  isToday && 'bg-zinc-50'
                )}>
                  <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">{label}</p>
                  <div className={cn(
                    'inline-flex items-center justify-center w-7 h-7 rounded-full mt-1 text-sm font-medium',
                    isToday ? 'bg-black text-white' : 'text-zinc-700'
                  )}>
                    {day}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Task columns */}
          <div className="grid grid-cols-7 divide-x divide-zinc-100">
            {days.map(({ dateStr, tasks: dayTasks }) => {
              const isToday = dateStr === todayStr
              return (
                <div key={dateStr} className={cn('min-h-[520px] p-2 space-y-1', isToday && 'bg-zinc-50/40')}>
                  {dayTasks.length === 0 ? (
                    <div className="h-full flex items-start justify-center pt-8">
                      <span className="text-[10px] text-zinc-200">—</span>
                    </div>
                  ) : (
                    dayTasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/dashboard/${task.workspace_id}`}
                        title={`${task.title} — ${task.workspaceName}`}
                        className={cn(
                          'flex items-start gap-1 px-1.5 py-1 text-[11px] leading-tight rounded-sm block hover:opacity-80 transition-opacity',
                          STATUS_CHIP[task.status] ?? 'bg-zinc-100 text-zinc-600'
                        )}
                      >
                        <span className={cn('shrink-0 w-1.5 h-1.5 rounded-full mt-0.5', STATUS_DOT[task.status])} />
                        <span className="line-clamp-2">{task.title}</span>
                      </Link>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {tasks.length === 0 && (
          <div className="mt-6 flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
              <CalendarDays size={18} strokeWidth={1.5} className="text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-900">No tasks due this week</p>
            <p className="text-xs text-zinc-400 mt-1">Add due dates to tasks to see them here.</p>
          </div>
        )}
      </div>
    )
  }

  // ── Month view ──────────────────────────────────────────────────────────────
  const year  = Number(params.year)  || today.getFullYear()
  const month = Number(params.month) || today.getMonth() + 1

  const totalDays = daysInMonth(year, month)
  const offset    = firstWeekdayOfMonth(year, month)

  const rangeStart = `${year}-${padDate(month)}-01`
  const rangeEnd   = `${year}-${padDate(month)}-${padDate(totalDays)}`

  const { data: rawTasks } = await supabase
    .from('tasks')
    .select('id, title, status, start_date, due_date, workspace_id, workspaces(name)')
    .or([
      `and(due_date.gte.${rangeStart},due_date.lte.${rangeEnd})`,
      `and(start_date.gte.${rangeStart},start_date.lte.${rangeEnd})`,
      `and(start_date.lte.${rangeStart},due_date.gte.${rangeEnd})`,
    ].join(','))
    .order('due_date', { ascending: true, nullsFirst: false })

  const tasks: CalendarTask[] = (rawTasks ?? []).map((t) => ({
    id:            t.id,
    title:         t.title,
    status:        t.status,
    start_date:    t.start_date ?? null,
    due_date:      t.due_date ?? null,
    workspace_id:  t.workspace_id,
    workspaceName: (t.workspaces as { name: string } | null)?.name ?? 'Unknown',
  }))

  const byDate = buildByDate(tasks, rangeStart, rangeEnd)

  const prev = prevMonth(year, month)
  const next = nextMonth(year, month)
  const prevHref = `/dashboard/calendar?view=month&year=${prev.year}&month=${prev.month}`
  const nextHref = `/dashboard/calendar?view=month&year=${next.year}&month=${next.month}`

  type Cell = { day: number | null; dateStr: string | null; tasks: CalendarTask[] }
  const cells: Cell[] = []
  for (let i = 0; i < offset; i++) cells.push({ day: null, dateStr: null, tasks: [] })
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${padDate(month)}-${padDate(d)}`
    cells.push({ day: d, dateStr, tasks: byDate[dateStr] ?? [] })
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: null, tasks: [] })

  const thisWeekStart = getWeekMonday(today)
  const weekViewHref  = `/dashboard/calendar?view=week&weekStart=${thisWeekStart}`

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-black tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-zinc-500">Tasks with due dates across all workspaces.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden h-8">
            <span className="px-3 h-full flex items-center text-xs font-medium bg-black text-white">Month</span>
            <span className="w-px h-4 bg-zinc-200" />
            <Link href={weekViewHref} className="px-3 h-full flex items-center text-xs text-zinc-500 hover:bg-zinc-50 transition-colors">Week</Link>
          </div>

          {/* Month navigation */}
          <Link href={prevHref} className="flex items-center justify-center w-8 h-8 border border-zinc-200 text-zinc-500 hover:text-black hover:border-zinc-300 transition-colors rounded-lg" aria-label="Previous month">
            <ChevronLeft size={14} strokeWidth={1.5} />
          </Link>
          <span className="text-sm font-medium text-black tabular-nums min-w-[120px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Link href={nextHref} className="flex items-center justify-center w-8 h-8 border border-zinc-200 text-zinc-500 hover:text-black hover:border-zinc-300 transition-colors rounded-lg" aria-label="Next month">
            <ChevronRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      </div>

      {/* Status legend */}
      <div className="mb-4 flex items-center gap-4 flex-wrap">
        {Object.entries(STATUS_DOT).map(([status, dotClass]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} />
            <span className="text-xs text-zinc-400 capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="bg-white border border-zinc-100 overflow-hidden rounded-xl">
        <div className="grid grid-cols-7 border-b border-zinc-100">
          {DAY_LABELS.map((day) => (
            <div key={day} className="px-3 py-2 text-[10px] font-medium text-zinc-400 uppercase tracking-widest text-center border-r border-zinc-100 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const isToday   = cell.dateStr === todayStr
            const isWeekend = i % 7 >= 5
            return (
              <div
                key={i}
                className={cn(
                  'min-h-[100px] p-2 border-b border-r border-zinc-100',
                  (i + 1) % 7 === 0 && 'border-r-0',
                  i >= cells.length - 7 && 'border-b-0',
                  isWeekend && cell.day && 'bg-zinc-50/40',
                  !cell.day && 'bg-zinc-50/20',
                )}
              >
                {cell.day !== null && (
                  <>
                    <div className={cn(
                      'inline-flex items-center justify-center w-6 h-6 text-xs font-medium mb-1.5',
                      isToday ? 'bg-black text-white rounded-full' : 'text-zinc-400'
                    )}>
                      {cell.day}
                    </div>
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
                          <span className={cn('shrink-0 w-1.5 h-1.5 rounded-full', STATUS_DOT[task.status])} />
                          <span className="truncate">{task.title}</span>
                        </Link>
                      ))}
                      {cell.tasks.length > 3 && (
                        <p className="px-1.5 text-[10px] text-zinc-400">+{cell.tasks.length - 3} more</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {tasks.length === 0 && (
        <div className="mt-6 flex flex-col items-center justify-center py-12 text-center">
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
            <CalendarDays size={18} strokeWidth={1.5} className="text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-900">No tasks due in {MONTH_NAMES[month - 1]}</p>
          <p className="text-xs text-zinc-400 mt-1">Add due dates to tasks on the board to see them here.</p>
        </div>
      )}
    </div>
  )
}
