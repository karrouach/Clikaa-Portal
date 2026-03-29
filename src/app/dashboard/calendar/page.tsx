import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CalendarClient } from './CalendarClient'

export const metadata: Metadata = { title: 'Calendar' }

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// ─── Date helpers ─────────────────────────────────────────────────────────────
function daysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate() }

function firstWeekdayOfMonth(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay()
  return (day + 6) % 7 // Mon = 0 … Sun = 6
}

function padDate(n: number) { return String(n).padStart(2, '0') }

/** Format a Date using local calendar fields (avoids UTC-offset date shifts). */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${padDate(d.getMonth() + 1)}-${padDate(d.getDate())}`
}

function getWeekMonday(date: Date): string {
  const d   = new Date(date)
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow))
  return isoLocal(d)
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return isoLocal(d)
}

function formatWeekDay(iso: string): { label: string; day: number } {
  const d = new Date(iso + 'T00:00:00')
  return {
    label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    day:   d.getDate(),
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
interface Props {
  searchParams: Promise<{ month?: string; year?: string; view?: string; weekStart?: string }>
}

export default async function CalendarPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin  = createAdminClient()
  const params = await searchParams
  const today  = new Date()
  const todayStr = isoLocal(today)
  const view   = params.view === 'month' ? 'month' : 'week'

  // Workspaces for the "Schedule Meeting" dropdown (admin client to bypass RLS)
  const { data: rawWorkspaces } = await admin
    .from('workspaces')
    .select('id, name')
    .order('name', { ascending: true })
  const workspaces = (rawWorkspaces ?? []) as { id: string; name: string }[]

  // ── Week view ───────────────────────────────────────────────────────────────
  if (view === 'week') {
    const weekStart = params.weekStart ?? getWeekMonday(today)
    const weekEnd   = addDays(weekStart, 6)

    // Tasks — due_date in week range only
    const { data: rawTasks } = await supabase
      .from('tasks')
      .select('id, title, status, due_date, workspace_id, workspaces(name)')
      .gte('due_date', weekStart)
      .lte('due_date', weekEnd)
      .order('due_date', { ascending: true, nullsFirst: false })

    const tasks = (rawTasks ?? [])
      .filter((t) => t.due_date)
      .map((t) => ({
        id:            t.id,
        title:         t.title,
        status:        t.status,
        due_date:      t.due_date!,
        workspace_id:  t.workspace_id,
        workspaceName: (t.workspaces as { name: string } | null)?.name ?? '',
      }))

    // Meetings in week range
    const { data: rawMeetings } = await admin
      .from('meetings')
      .select('id, workspace_id, title, meeting_date, meeting_link, workspaces(name)')
      .gte('meeting_date', weekStart + 'T00:00:00')
      .lte('meeting_date', weekEnd + 'T23:59:59')
      .order('meeting_date', { ascending: true })

    const meetings = (rawMeetings ?? []).map((m) => ({
      id:            m.id,
      workspace_id:  m.workspace_id,
      title:         m.title,
      meeting_date:  m.meeting_date,
      meeting_link:  (m.meeting_link as string | null) ?? null,
      workspaceName: (m.workspaces as { name: string } | null)?.name ?? '',
    }))

    // Navigation
    const prevWeekStart = addDays(weekStart, -7)
    const nextWeekStart = addDays(weekStart, 7)
    const weekLabel = (() => {
      const s = new Date(weekStart + 'T00:00:00')
      const e = new Date(weekEnd   + 'T00:00:00')
      return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    })()

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const ds = addDays(weekStart, i)
      const { label, day } = formatWeekDay(ds)
      return { dateStr: ds, dayLabel: label, dayNum: day }
    })

    return (
      <CalendarClient
        view="week"
        todayStr={todayStr}
        tasks={tasks}
        meetings={meetings}
        workspaces={workspaces}
        prevHref={`/dashboard/calendar?view=week&weekStart=${prevWeekStart}`}
        nextHref={`/dashboard/calendar?view=week&weekStart=${nextWeekStart}`}
        navLabel={weekLabel}
        weekViewHref={`/dashboard/calendar?view=week&weekStart=${getWeekMonday(today)}`}
        monthViewHref={`/dashboard/calendar?view=month&year=${today.getFullYear()}&month=${today.getMonth() + 1}`}
        weekDays={weekDays}
        cells={[]}
      />
    )
  }

  // ── Month view ──────────────────────────────────────────────────────────────
  const year  = Number(params.year)  || today.getFullYear()
  const month = Number(params.month) || today.getMonth() + 1

  const totalDays  = daysInMonth(year, month)
  const offset     = firstWeekdayOfMonth(year, month)
  const rangeStart = `${year}-${padDate(month)}-01`
  const rangeEnd   = `${year}-${padDate(month)}-${padDate(totalDays)}`

  const { data: rawTasks } = await supabase
    .from('tasks')
    .select('id, title, status, due_date, workspace_id, workspaces(name)')
    .gte('due_date', rangeStart)
    .lte('due_date', rangeEnd)
    .order('due_date', { ascending: true, nullsFirst: false })

  const tasks = (rawTasks ?? [])
    .filter((t) => t.due_date)
    .map((t) => ({
      id:            t.id,
      title:         t.title,
      status:        t.status,
      due_date:      t.due_date!,
      workspace_id:  t.workspace_id,
      workspaceName: (t.workspaces as { name: string } | null)?.name ?? '',
    }))

  const { data: rawMeetings } = await admin
    .from('meetings')
    .select('id, workspace_id, title, meeting_date, meeting_link, workspaces(name)')
    .gte('meeting_date', rangeStart + 'T00:00:00')
    .lte('meeting_date', rangeEnd + 'T23:59:59')
    .order('meeting_date', { ascending: true })

  const meetings = (rawMeetings ?? []).map((m) => ({
    id:            m.id,
    workspace_id:  m.workspace_id,
    title:         m.title,
    meeting_date:  m.meeting_date,
    meeting_link:  (m.meeting_link as string | null) ?? null,
    workspaceName: (m.workspaces as { name: string } | null)?.name ?? '',
  }))

  // Build calendar cells
  const cells: { day: number | null; dateStr: string | null }[] = []
  for (let i = 0; i < offset; i++) cells.push({ day: null, dateStr: null })
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, dateStr: `${year}-${padDate(month)}-${padDate(d)}` })
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: null })

  // Navigation
  const prevM = month === 1  ? { year: year - 1, month: 12 }         : { year, month: month - 1 }
  const nextM = month === 12 ? { year: year + 1, month:  1 }         : { year, month: month + 1 }

  return (
    <CalendarClient
      view="month"
      todayStr={todayStr}
      tasks={tasks}
      meetings={meetings}
      workspaces={workspaces}
      prevHref={`/dashboard/calendar?view=month&year=${prevM.year}&month=${prevM.month}`}
      nextHref={`/dashboard/calendar?view=month&year=${nextM.year}&month=${nextM.month}`}
      navLabel={`${MONTH_NAMES[month - 1]} ${year}`}
      weekViewHref={`/dashboard/calendar?view=week&weekStart=${getWeekMonday(today)}`}
      monthViewHref={`/dashboard/calendar?view=month&year=${year}&month=${month}`}
      weekDays={[]}
      cells={cells}
    />
  )
}
