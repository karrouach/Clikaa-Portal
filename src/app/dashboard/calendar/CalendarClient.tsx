'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarDays, Video, X, Plus, ExternalLink, Loader2, CalendarIcon, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createMeeting } from './meeting-actions'
import { toast } from 'sonner'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

// ─── Types ────────────────────────────────────────────────────────────────────
type CalendarTask = {
  id: string
  title: string
  status: string
  due_date: string
  workspace_id: string
  workspaceName: string
}

type CalendarMeeting = {
  id: string
  workspace_id: string
  title: string
  meeting_date: string
  meeting_link: string | null
  workspaceName: string
}

interface Props {
  view: 'week' | 'month'
  todayStr: string
  tasks: CalendarTask[]
  meetings: CalendarMeeting[]
  workspaces: { id: string; name: string }[]
  prevHref: string
  nextHref: string
  navLabel: string
  weekViewHref: string
  monthViewHref: string
  weekDays: { dateStr: string; dayLabel: string; dayNum: number }[]
  cells: { day: number | null; dateStr: string | null }[]
}

// ─── Time slots (every 30 min) ────────────────────────────────────────────────
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

// ─── Status legend colours ────────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  todo:        'bg-zinc-300',
  pending:     'bg-amber-400',
  in_progress: 'bg-blue-400',
  review:      'bg-violet-400',
  done:        'bg-emerald-400',
}

const STATUS_LABEL: Record<string, string> = {
  todo:        'To Do',
  pending:     'Pending',
  in_progress: 'In Progress',
  review:      'Review',
  done:        'Done',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CalendarClient({
  view, todayStr, tasks, meetings, workspaces,
  prevHref, nextHref, navLabel, weekViewHref, monthViewHref,
  weekDays, cells,
}: Props) {
  // ── Modal state ──────────────────────────────────────────────────────────────
  const [showSchedule,     setShowSchedule]     = useState(false)
  const [selectedMeeting,  setSelectedMeeting]  = useState<CalendarMeeting | null>(null)
  const [isPending,        startTransition]      = useTransition()

  // ── Form state ───────────────────────────────────────────────────────────────
  const [fWsId,     setFWsId]     = useState(workspaces[0]?.id ?? '')
  const [fTitle,    setFTitle]    = useState('')
  const [fDatePart, setFDatePart] = useState<Date | undefined>(undefined)
  const [fTimePart, setFTimePart] = useState('09:00')
  const [fLink,     setFLink]     = useState('')
  const [dateOpen,  setDateOpen]  = useState(false)
  const [timeOpen,  setTimeOpen]  = useState(false)

  // ── Build date → items maps ──────────────────────────────────────────────────
  const tasksByDate: Record<string, CalendarTask[]> = {}
  for (const t of tasks) {
    const ds = t.due_date.slice(0, 10)
    ;(tasksByDate[ds] ??= []).push(t)
  }

  const meetingsByDate: Record<string, CalendarMeeting[]> = {}
  for (const m of meetings) {
    const ds = m.meeting_date.slice(0, 10)
    ;(meetingsByDate[ds] ??= []).push(m)
  }

  // ── Schedule submit ──────────────────────────────────────────────────────────
  function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fWsId || !fTitle.trim() || !fDatePart) return
    const [hours, mins] = (fTimePart || '00:00').split(':').map(Number)
    const combined = new Date(fDatePart)
    combined.setHours(hours, mins, 0, 0)
    startTransition(async () => {
      const result = await createMeeting(
        fWsId,
        fTitle.trim(),
        combined.toISOString(),
        fLink || null,
      )
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Meeting scheduled')
        setShowSchedule(false)
        setFTitle('')
        setFDatePart(undefined)
        setFTimePart('09:00')
        setFLink('')
      }
    })
  }

  // ── Day cell renderer ────────────────────────────────────────────────────────
  function renderDayItems(dateStr: string, maxVisible?: number) {
    const dayMeetings = (meetingsByDate[dateStr] ?? [])
      .slice()
      .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))
    const dayTasks = tasksByDate[dateStr] ?? []

    type Item =
      | { type: 'meeting'; data: CalendarMeeting }
      | { type: 'task';    data: CalendarTask }

    const all: Item[] = [
      ...dayMeetings.map((m): Item => ({ type: 'meeting', data: m })),
      ...dayTasks.map((t):    Item => ({ type: 'task',    data: t })),
    ]

    const visible  = maxVisible ? all.slice(0, maxVisible) : all
    const overflow = maxVisible ? Math.max(0, all.length - maxVisible) : 0

    return (
      <>
        {visible.map((item) => {
          if (item.type === 'meeting') {
            const m = item.data
            return (
              <button
                key={`m-${m.id}`}
                onClick={() => setSelectedMeeting(m)}
                className="w-full text-left flex items-center gap-1 px-1.5 py-0.5 rounded bg-black text-white dark:bg-white dark:text-black text-[11px] font-medium hover:opacity-75 transition-opacity"
              >
                <Video size={8} strokeWidth={2} className="shrink-0" />
                <span className="truncate">{fmtTime(m.meeting_date)} {m.title}</span>
              </button>
            )
          }
          const t = item.data
          return (
            <Link
              key={`t-${t.id}`}
              href={`/dashboard/${t.workspace_id}?taskId=${t.id}`}
              title={`${t.title} — ${t.workspaceName}`}
              className="w-full flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors truncate"
            >
              <span className={cn('shrink-0 w-1.5 h-1.5 rounded-full', STATUS_DOT[t.status] ?? 'bg-zinc-300')} />
              <span className="truncate">{t.title}</span>
            </Link>
          )
        })}
        {overflow > 0 && (
          <p className="px-1.5 text-[10px] text-zinc-400">+{overflow} more</p>
        )}
      </>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="animate-fade-in">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-white tracking-tight">Calendar</h1>
            <p className="mt-1 text-sm text-zinc-500">Deadlines &amp; meetings across all workspaces.</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Schedule Meeting CTA */}
            <button
              onClick={() => setShowSchedule(true)}
              className="flex items-center gap-1.5 h-8 px-3 bg-black dark:bg-white text-white dark:text-black text-xs font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-gray-200 transition-colors whitespace-nowrap"
            >
              <Plus size={13} strokeWidth={2} />
              Schedule Meeting
            </button>

            {/* View toggle */}
            <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden h-8">
              {view === 'week' ? (
                <>
                  <span className="px-3 h-full flex items-center text-xs font-medium bg-black text-white">Week</span>
                  <span className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
                  <Link href={monthViewHref} className="px-3 h-full flex items-center text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Month</Link>
                </>
              ) : (
                <>
                  <Link href={weekViewHref} className="px-3 h-full flex items-center text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Week</Link>
                  <span className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
                  <span className="px-3 h-full flex items-center text-xs font-medium bg-black text-white">Month</span>
                </>
              )}
            </div>

            {/* Navigation */}
            <Link href={prevHref} className="flex items-center justify-center w-8 h-8 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors rounded-lg">
              <ChevronLeft size={14} strokeWidth={1.5} />
            </Link>
            <span className="text-sm font-medium text-black dark:text-white tabular-nums whitespace-nowrap">{navLabel}</span>
            <Link href={nextHref} className="flex items-center justify-center w-8 h-8 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors rounded-lg">
              <ChevronRight size={14} strokeWidth={1.5} />
            </Link>
          </div>
        </div>

        {/* ── Legend ────────────────────────────────────────────────────────── */}
        <div className="mb-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-black dark:bg-white shrink-0" />
            <span className="text-xs text-zinc-400">Meeting</span>
          </div>
          {Object.entries(STATUS_DOT).map(([status, dotClass]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} />
              <span className="text-xs text-zinc-400">{STATUS_LABEL[status] ?? status}</span>
            </div>
          ))}
        </div>

        {/* ── Week grid ─────────────────────────────────────────────────────── */}
        {view === 'week' && (
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 overflow-hidden rounded-xl">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800">
              {weekDays.map(({ dateStr, dayLabel, dayNum }) => {
                const isToday = dateStr === todayStr
                return (
                  <div key={dateStr} className={cn('px-3 py-3 text-center border-r border-zinc-100 dark:border-zinc-800 last:border-r-0', isToday && 'bg-zinc-50 dark:bg-zinc-900')}>
                    <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">{dayLabel}</p>
                    <div className={cn('inline-flex items-center justify-center w-7 h-7 rounded-full mt-1 text-sm font-medium', isToday ? 'bg-black text-white' : 'text-zinc-700 dark:text-zinc-300')}>
                      {dayNum}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Day columns */}
            <div className="grid grid-cols-7 divide-x divide-zinc-100 dark:divide-zinc-800">
              {weekDays.map(({ dateStr }) => {
                const isToday = dateStr === todayStr
                const isEmpty = !meetingsByDate[dateStr]?.length && !tasksByDate[dateStr]?.length
                return (
                  <div key={dateStr} className={cn('min-h-[520px] p-2 space-y-1', isToday && 'bg-zinc-50/40 dark:bg-zinc-900/40')}>
                    {isEmpty ? (
                      <div className="h-full flex items-start justify-center pt-8">
                        <span className="text-[10px] text-zinc-200">—</span>
                      </div>
                    ) : (
                      renderDayItems(dateStr)
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Month grid ────────────────────────────────────────────────────── */}
        {view === 'month' && (
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 overflow-hidden rounded-xl">
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
                <div key={d} className="px-3 py-2 text-[10px] font-medium text-zinc-400 uppercase tracking-widest text-center border-r border-zinc-100 dark:border-zinc-800 last:border-r-0">{d}</div>
              ))}
            </div>
            {/* Cells */}
            <div className="grid grid-cols-7">
              {cells.map((cell, i) => {
                const isToday   = cell.dateStr === todayStr
                const isWeekend = i % 7 >= 5
                return (
                  <div
                    key={i}
                    className={cn(
                      'min-h-[100px] p-2 border-b border-r border-zinc-100 dark:border-zinc-800',
                      (i + 1) % 7 === 0 && 'border-r-0',
                      i >= cells.length - 7  && 'border-b-0',
                      isWeekend && cell.day   && 'bg-zinc-50/40 dark:bg-zinc-900/20',
                      !cell.day               && 'bg-zinc-50/20 dark:bg-zinc-900/10',
                    )}
                  >
                    {cell.day !== null && cell.dateStr && (
                      <>
                        <div className={cn(
                          'inline-flex items-center justify-center w-6 h-6 text-xs font-medium mb-1.5',
                          isToday ? 'bg-black text-white rounded-full' : 'text-zinc-400 dark:text-zinc-500'
                        )}>
                          {cell.day}
                        </div>
                        <div className="space-y-0.5">
                          {renderDayItems(cell.dateStr, 3)}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {tasks.length === 0 && meetings.length === 0 && (
          <div className="mt-6 flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
              <CalendarDays size={18} strokeWidth={1.5} className="text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">Nothing scheduled</p>
            <p className="text-xs text-zinc-400 mt-1">Add due dates to tasks or schedule a meeting to see them here.</p>
          </div>
        )}
      </div>

      {/* ── Meeting detail modal ──────────────────────────────────────────────── */}
      {selectedMeeting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedMeeting(null)}
        >
          <div
            className="bg-white dark:bg-[#1A1A1A] rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-black dark:bg-white flex items-center justify-center shrink-0">
                  <Video size={14} strokeWidth={1.5} className="text-white dark:text-black" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-black dark:text-white">{selectedMeeting.title}</p>
                  <p className="text-xs text-zinc-400">{selectedMeeting.workspaceName}</p>
                </div>
              </div>
              <button onClick={() => setSelectedMeeting(null)} className="text-zinc-400 hover:text-black dark:hover:text-white transition-colors mt-0.5">
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-medium mb-1">Date &amp; Time</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{fmtFull(selectedMeeting.meeting_date)}</p>
              </div>
              {selectedMeeting.meeting_link && (
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-medium mb-1">Meeting Link</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{selectedMeeting.meeting_link}</p>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="px-5 pb-5">
              {selectedMeeting.meeting_link ? (
                <a
                  href={selectedMeeting.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 w-full h-9 bg-black dark:bg-white text-white dark:text-black text-xs font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-gray-200 transition-colors"
                >
                  <ExternalLink size={12} strokeWidth={1.5} />
                  Join Meeting
                </a>
              ) : (
                <p className="text-xs text-zinc-400 text-center">No meeting link added.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule Meeting modal ─────────────────────────────────────────────── */}
      {showSchedule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowSchedule(false)}
        >
          <div
            className="bg-white dark:bg-[#1A1A1A] rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-black dark:text-white">Schedule Meeting</h2>
              <button onClick={() => setShowSchedule(false)} className="text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="px-5 py-4 space-y-3.5">
              {/* Workspace */}
              <div>
                <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-1.5">Workspace</label>
                <select
                  value={fWsId}
                  onChange={(e) => setFWsId(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                  ))}
                  {workspaces.length === 0 && (
                    <option value="" disabled>No workspaces available</option>
                  )}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-1.5">Title</label>
                <input
                  type="text"
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  placeholder="e.g. Monthly Sync"
                  required
                  className="w-full h-9 px-3 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors placeholder:text-zinc-400"
                />
              </div>

              {/* Date & Time */}
              <div>
                <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-1.5">Date &amp; Time</label>
                <div className="flex gap-2">
                  {/* Date picker */}
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'flex-1 flex items-center gap-2 h-9 px-3 text-sm rounded-lg border transition-colors',
                          'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800',
                          'hover:border-zinc-300 dark:hover:border-zinc-600',
                          'focus-visible:outline-none',
                          !fDatePart && 'text-zinc-400',
                        )}
                      >
                        <CalendarIcon size={13} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
                        <span className={fDatePart ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}>
                          {fDatePart
                            ? fDatePart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'Pick a date'
                          }
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="p-0 w-auto" style={{ zIndex: 9999 }}>
                      <Calendar
                        mode="single"
                        selected={fDatePart}
                        onSelect={(d) => { setFDatePart(d ?? undefined); setDateOpen(false) }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Time picker */}
                  <Popover open={timeOpen} onOpenChange={setTimeOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-24 h-9 flex items-center justify-center gap-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-900 dark:text-zinc-100 focus-visible:outline-none transition-colors"
                      >
                        <Clock size={12} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
                        {fTimePart}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="p-1 w-28 bg-white dark:bg-[#1A1A1A] rounded-xl border border-gray-200 dark:border-zinc-800 shadow-md"
                      style={{ zIndex: 9999 }}
                    >
                      <div className="max-h-52 overflow-y-auto space-y-0.5">
                        {TIME_SLOTS.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => { setFTimePart(slot); setTimeOpen(false) }}
                            className={cn(
                              'w-full text-left px-2 py-1 rounded-md text-xs transition-colors',
                              slot === fTimePart
                                ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                                : 'text-zinc-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                            )}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Meeting URL */}
              <div>
                <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-1.5">
                  Meeting URL <span className="normal-case font-normal text-zinc-300 dark:text-zinc-600">(optional)</span>
                </label>
                <input
                  type="url"
                  value={fLink}
                  onChange={(e) => setFLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="w-full h-9 px-3 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors placeholder:text-zinc-400"
                />
              </div>

              <button
                type="submit"
                disabled={isPending || !fTitle.trim() || !fDatePart || !fWsId}
                className="w-full h-9 flex items-center justify-center gap-1.5 bg-black dark:bg-white text-white dark:text-black text-xs font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPending
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Video size={12} strokeWidth={1.5} />
                }
                Schedule Meeting
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
