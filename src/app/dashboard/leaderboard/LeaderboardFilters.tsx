'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const TIMEFRAME_OPTIONS = [
  { value: 'all',   label: 'All Time'   },
  { value: 'month', label: 'This Month' },
]

export function LeaderboardFilters({ timeframe }: { timeframe: string }) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`/dashboard/leaderboard?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <select
          value={timeframe}
          onChange={(e) => update('timeframe', e.target.value)}
          className={cn(
            'h-8 px-2.5 pr-7 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300',
            'focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors cursor-pointer appearance-none',
          )}
        >
          {TIMEFRAME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown size={12} strokeWidth={1.5} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
      </div>
    </div>
  )
}
