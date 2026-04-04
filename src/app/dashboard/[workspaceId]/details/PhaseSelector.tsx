'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { updateWorkspacePhase } from './phase-actions'
import { cn } from '@/lib/utils'

const PHASES = [
  'Brief & Planning',
  'Design',
  'Development',
  'Review & Approval',
  'Launch',
]

interface Props {
  workspaceId: string
  currentPhase: number
  isAdmin: boolean
}

export function PhaseSelector({ workspaceId, currentPhase: initialPhase, isAdmin }: Props) {
  const [phase, setPhase] = useState(initialPhase)
  const [isPending, startTransition] = useTransition()

  function handleChange(value: number) {
    setPhase(value)
    startTransition(async () => {
      await updateWorkspacePhase(workspaceId, value)
    })
  }

  return (
    <div className="space-y-4">
      {/* Admin phase selector */}
      {isAdmin && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">Set current phase</p>
          <div className="relative flex items-center gap-2">
            {isPending && <Loader2 size={12} strokeWidth={1.5} className="text-zinc-400 animate-spin" />}
            <select
              value={phase}
              onChange={e => handleChange(Number(e.target.value))}
              disabled={isPending}
              className="appearance-none h-8 pl-3 pr-8 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-700 dark:text-white focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 cursor-pointer disabled:opacity-50 transition-colors"
            >
              {PHASES.map((name, i) => (
                <option key={i} value={i + 1}>
                  Phase {i + 1}: {name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} strokeWidth={1.5} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Visual timeline */}
      <div className="relative">
        <div className="absolute left-[13px] top-3 bottom-3 w-px bg-zinc-100" />
        <div className="space-y-0">
          {PHASES.map((name, i) => {
            const isDone    = i < phase - 1
            const isCurrent = i === phase - 1
            const isFuture  = i > phase - 1

            return (
              <div key={name} className="flex items-start gap-3.5 pb-4 last:pb-0 relative">
                <div className={cn(
                  'shrink-0 w-[27px] h-[27px] rounded-full border-2 flex items-center justify-center z-10',
                  isDone    ? 'bg-black border-black'
                  : isCurrent ? 'bg-white border-black'
                  : 'bg-white border-zinc-200'
                )}>
                  {isDone ? (
                    <span className="text-white text-[10px]">✓</span>
                  ) : isCurrent ? (
                    <span className="w-2.5 h-2.5 bg-black dark:bg-white rounded-full animate-pulse block" />
                  ) : (
                    <span className="w-2 h-2 bg-zinc-200 rounded-full block" />
                  )}
                </div>
                <div className="pt-1">
                  <p className={cn(
                    'text-sm',
                    isDone    ? 'text-zinc-400 line-through'
                    : isCurrent ? 'font-semibold text-black'
                    : 'text-zinc-400'
                  )}>
                    {name}
                  </p>
                  {isCurrent && <p className="text-[11px] text-zinc-500 mt-0.5">In progress</p>}
                  {isDone    && <p className="text-[11px] text-zinc-300 mt-0.5">Completed</p>}
                  {isFuture  && <p className="text-[11px] text-zinc-300 mt-0.5">Upcoming</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
