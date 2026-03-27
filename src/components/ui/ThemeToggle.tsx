'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ThemeToggle({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  const isDark = theme === 'dark'

  if (isCollapsed) {
    return (
      <button
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="w-full flex items-center justify-center py-2.5 text-zinc-400 hover:text-white hover:bg-white/8 transition-colors rounded-lg"
      >
        {isDark ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center gap-3 py-2.5 px-3 text-sm text-zinc-400 hover:bg-white/8 hover:text-zinc-200 transition-all duration-150 rounded-lg w-full"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="shrink-0">
        {isDark ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
      </span>
      <span className="text-sm">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  )
}

// ── Compact toggle for Header ─────────────────────────────────────────────────
export function ThemeToggleCompact() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return null
  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'flex items-center justify-center w-7 h-7 rounded-lg transition-colors duration-150',
        'text-zinc-500 hover:text-black hover:bg-zinc-100',
        'dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'
      )}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark
        ? <Sun  size={14} strokeWidth={1.5} />
        : <Moon size={14} strokeWidth={1.5} />
      }
    </button>
  )
}
