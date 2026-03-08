'use client'

import { useState, useTransition, useEffect } from 'react'
import { Check, Loader2, Save } from 'lucide-react'
import { updateWorkspaceGoals } from '@/app/dashboard/workspace-actions'

// ─── GoalsEditor ──────────────────────────────────────────────────────────────

interface GoalsEditorProps {
  workspaceId: string
  initialValue: string | null
}

/**
 * Editable textarea for project goals — admin-only.
 * Saves to the workspace description field via server action.
 */
export function GoalsEditor({ workspaceId, initialValue }: GoalsEditorProps) {
  const [value, setValue]   = useState(initialValue ?? '')
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [isPending, start]  = useTransition()

  function handleSave() {
    setError(null)
    setSaved(false)
    start(async () => {
      const result = await updateWorkspaceGoals(workspaceId, value.trim())
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    })
  }

  return (
    <div className="space-y-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        placeholder="Describe the project goals, vision, and desired outcomes…"
        className="
          w-full rounded-lg border border-zinc-200 bg-white
          text-sm text-zinc-900 placeholder:text-zinc-400
          px-3 py-2.5 resize-none leading-relaxed
          hover:border-zinc-300
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-zinc-900 focus-visible:ring-offset-2
          transition-colors duration-150
        "
      />

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="
            flex items-center gap-1.5 h-8 px-4
            bg-zinc-900 text-white text-xs font-medium rounded-lg
            hover:bg-zinc-700 transition-colors duration-150
            disabled:opacity-60 disabled:cursor-not-allowed
          "
        >
          {isPending ? (
            <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
          ) : (
            <Save size={12} strokeWidth={1.5} />
          )}
          {isPending ? 'Saving…' : 'Save goals'}
        </button>

        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <Check size={12} strokeWidth={2} />
            Saved
          </span>
        )}
      </div>
    </div>
  )
}

// ─── BrandColors ──────────────────────────────────────────────────────────────

interface BrandColorsProps {
  workspaceId: string
}

const DEFAULT_COLORS = {
  primary:   '#111111',
  secondary: '#F6F4EF',
}

/**
 * Brand color swatches with color-picker inputs.
 * Colors are persisted to localStorage (keyed by workspaceId).
 * No database migration required.
 */
export function BrandColors({ workspaceId }: BrandColorsProps) {
  const storageKey = `clikaa_brand_${workspaceId}`

  const [colors, setColors] = useState(DEFAULT_COLORS)
  const [mounted, setMounted] = useState(false)

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) setColors(JSON.parse(stored))
    } catch {
      // ignore
    }
    setMounted(true)
  }, [storageKey])

  function handleChange(key: 'primary' | 'secondary', value: string) {
    const next = { ...colors, [key]: value }
    setColors(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  if (!mounted) return null

  const swatches: { key: 'primary' | 'secondary'; label: string }[] = [
    { key: 'primary',   label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
  ]

  return (
    <div className="flex flex-wrap gap-6">
      {swatches.map(({ key, label }) => (
        <label
          key={key}
          className="flex flex-col gap-2 cursor-pointer group"
          title={`Change ${label.toLowerCase()} brand colour`}
        >
          {/* Swatch preview */}
          <div
            className="
              w-16 h-16 rounded-xl border border-zinc-200
              group-hover:border-zinc-300 transition-colors duration-150
              relative overflow-hidden
            "
            style={{ backgroundColor: colors[key] }}
          >
            <input
              type="color"
              value={colors[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              aria-label={`${label} colour picker`}
            />
          </div>

          {/* Labels */}
          <div>
            <p className="text-xs font-medium text-zinc-700">{label}</p>
            <p className="text-[11px] text-zinc-400 font-mono uppercase">
              {colors[key]}
            </p>
          </div>
        </label>
      ))}

      <p className="self-end text-[11px] text-zinc-400 pb-1">
        Click a swatch to edit. Saved locally in your browser.
      </p>
    </div>
  )
}
