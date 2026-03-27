'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const TIMEFRAME_OPTIONS = [
  { value: 'all',   label: 'All Time'   },
  { value: 'month', label: 'This Month' },
]

const GROUP_OPTIONS = [
  { value: 'designers', label: 'Designers' },
  { value: 'everyone',  label: 'Everyone'  },
]

export function LeaderboardFilters({
  timeframe,
  group,
}: {
  timeframe: string
  group: string
}) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`/dashboard/leaderboard?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={timeframe}
        onChange={(e) => update('timeframe', e.target.value)}
        className={cn(
          'h-8 px-2.5 pr-7 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300',
          'focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors cursor-pointer appearance-none',
          'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_8px_center]'
        )}
      >
        {TIMEFRAME_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <select
        value={group}
        onChange={(e) => update('group', e.target.value)}
        className={cn(
          'h-8 px-2.5 pr-7 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300',
          'focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors cursor-pointer appearance-none',
          'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_8px_center]'
        )}
      >
        {GROUP_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
