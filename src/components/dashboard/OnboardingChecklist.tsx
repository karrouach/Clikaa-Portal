'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface ChecklistItem {
  id: string
  label: string
  subtext: string
  href?: string
  completed: boolean
}

interface OnboardingChecklistProps {
  hasFullName: boolean
  firstWorkspaceId: string | null
}

/**
 * Getting Started checklist for new client users.
 * "Complete profile" is driven by real data; the other two use local state
 * so clients feel immediate progress on first login.
 */
export function OnboardingChecklist({
  hasFullName,
  firstWorkspaceId,
}: OnboardingChecklistProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({
    strategy: false,
    assets:   false,
  })

  const items: ChecklistItem[] = [
    {
      id:        'profile',
      label:     'Complete your profile',
      subtext:   'Add your full name so your team knows who you are.',
      href:      '/dashboard/settings',
      completed: hasFullName,
    },
    {
      id:       'strategy',
      label:    'Review the Strategy Brief',
      subtext:  'Understand the project goals, brand identity, and stakeholders.',
      href:     firstWorkspaceId ? `/dashboard/${firstWorkspaceId}/strategy` : undefined,
      completed: checked.strategy,
    },
    {
      id:       'assets',
      label:    'Upload current brand assets',
      subtext:  'Share your logos, fonts, and brand guidelines with the team.',
      href:     firstWorkspaceId ? `/dashboard/${firstWorkspaceId}/files` : undefined,
      completed: checked.assets,
    },
  ]

  const completedCount = items.filter((i) => i.completed).length
  const allDone = completedCount === items.length
  const pct = Math.round((completedCount / items.length) * 100)

  if (allDone) return null

  return (
    <div className="mb-8 bg-white border border-zinc-100 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Getting Started</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            {completedCount} of {items.length} steps complete
          </p>
        </div>
        <span className="text-xs font-medium text-zinc-500">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-zinc-100 rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-zinc-900 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Checklist */}
      <ul className="space-y-3">
        {items.map((item) => {
          const canToggle = !item.completed && item.id !== 'profile'

          const inner = (
            <div
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg transition-colors duration-150',
                item.completed
                  ? 'opacity-50'
                  : 'hover:bg-zinc-50 cursor-pointer'
              )}
              onClick={() => {
                if (canToggle) setChecked((prev) => ({ ...prev, [item.id]: true }))
              }}
            >
              {/* Icon */}
              {item.completed ? (
                <CheckCircle2
                  size={16}
                  strokeWidth={1.5}
                  className="text-emerald-500 shrink-0 mt-0.5"
                />
              ) : (
                <Circle
                  size={16}
                  strokeWidth={1.5}
                  className="text-zinc-300 shrink-0 mt-0.5"
                />
              )}

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium',
                    item.completed ? 'line-through text-zinc-400' : 'text-zinc-900'
                  )}
                >
                  {item.label}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                  {item.subtext}
                </p>
              </div>

              {/* Arrow for linked items */}
              {!item.completed && item.href && (
                <ArrowRight
                  size={14}
                  strokeWidth={1.5}
                  className="text-zinc-300 shrink-0 mt-0.5"
                />
              )}
            </div>
          )

          return (
            <li key={item.id}>
              {item.href && !item.completed ? (
                <Link href={item.href} className="block">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
