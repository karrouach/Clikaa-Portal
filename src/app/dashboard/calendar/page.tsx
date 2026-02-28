import type { Metadata } from 'next'
import { CalendarDays } from 'lucide-react'

export const metadata: Metadata = { title: 'Calendar' }

export default function CalendarPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black tracking-tight">Calendar</h1>
        <p className="mt-1 text-sm text-zinc-500">Track deadlines and milestones across all your projects.</p>
      </div>

      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
          <CalendarDays size={20} strokeWidth={1.5} className="text-zinc-400" />
        </div>
        <h2 className="text-sm font-medium text-zinc-900 mb-1">Nothing scheduled yet</h2>
        <p className="text-sm text-zinc-400 max-w-xs">
          Calendar view is coming soon. Task deadlines and project milestones will appear here.
        </p>
      </div>
    </div>
  )
}
