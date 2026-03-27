'use client'

import { useState, useTransition, useEffect } from 'react'
import { Check, Loader2, Save, X } from 'lucide-react'
import { updateWorkspaceGoals } from '@/app/dashboard/workspace-actions'
import { cn } from '@/lib/utils'

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
          w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800
          text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500
          px-3 py-2.5 resize-none leading-relaxed
          hover:border-zinc-300 dark:hover:border-zinc-600
          focus-visible:outline-none focus-visible:border-zinc-300 dark:focus-visible:border-zinc-600
          focus-visible:shadow-[0_0_0_3px_rgba(0,0,0,0.05)]
          transition-all duration-200 ease-in-out
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
            bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-medium rounded-lg
            hover:bg-zinc-700 dark:hover:bg-gray-200 transition-colors duration-150
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

interface ColorSwatch {
  name: string
  hex: string
}

const DEFAULT_PALETTE: ColorSwatch[] = [
  { name: 'Primary',   hex: '#111111' },
  { name: 'Secondary', hex: '#846C2E' },
  { name: 'Accent 1',  hex: '#E5E7EB' },
  { name: 'Accent 2',  hex: '#2C3E50' },
  { name: 'Accent 3',  hex: '#F9F6F0' },
]

/**
 * Brand color swatches with color-picker inputs.
 * Colors are persisted to localStorage (keyed by workspaceId).
 * Supports a dynamic array of colors with an "Add Color" button.
 */
export function BrandColors({ workspaceId }: BrandColorsProps) {
  const storageKey = `clikaa_brand_${workspaceId}`

  const [colors, setColors]           = useState<ColorSwatch[]>([
    { name: 'Primary',   hex: '#111111' },
    { name: 'Secondary', hex: '#F6F4EF' },
  ])
  const [mounted, setMounted]         = useState(false)
  const [removingIndex, setRemoving]  = useState<number | null>(null)

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Migrate legacy { primary, secondary } format → array
        if (!Array.isArray(parsed)) {
          setColors([
            { name: 'Primary',   hex: parsed.primary   ?? '#111111' },
            { name: 'Secondary', hex: parsed.secondary ?? '#F6F4EF' },
          ])
        } else {
          setColors(parsed)
        }
      }
    } catch {
      // ignore
    }
    setMounted(true)
  }, [storageKey])

  function save(next: ColorSwatch[]) {
    setColors(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function handleChangeHex(index: number, hex: string) {
    save(colors.map((c, i) => i === index ? { ...c, hex } : c))
  }

  function handleAddColor() {
    const next = DEFAULT_PALETTE[colors.length] ?? { name: `Color ${colors.length + 1}`, hex: '#888888' }
    save([...colors, { ...next }])
  }

  function handleRemoveColor(index: number) {
    if (colors.length <= 1) return
    setRemoving(index)
    setTimeout(() => {
      save(colors.filter((_, i) => i !== index))
      setRemoving(null)
    }, 180)
  }

  if (!mounted) return null

  return (
    <div className="flex flex-wrap gap-6 items-start">
      {colors.map((color, i) => (
        <div
          key={i}
          className={cn(
            'flex flex-col gap-2 group/swatch transition-all duration-200 ease-in-out',
            removingIndex === i ? 'opacity-0 scale-90' : 'opacity-100 scale-100'
          )}
        >
          {/* Swatch + delete button */}
          <div className="relative">
            <label
              className="block w-16 h-16 rounded-xl border border-zinc-200 dark:border-zinc-700 group-hover/swatch:border-zinc-300 dark:group-hover/swatch:border-zinc-600 transition-colors duration-150 relative overflow-hidden cursor-pointer"
              title={`Change ${color.name.toLowerCase()} brand colour`}
              style={{ backgroundColor: color.hex }}
            >
              <input
                type="color"
                value={color.hex}
                onChange={(e) => handleChangeHex(i, e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                aria-label={`${color.name} colour picker`}
              />
            </label>

            {/* Delete button — visible on hover, hidden when only 1 swatch remains */}
            {colors.length > 1 && (
              <button
                onClick={() => handleRemoveColor(i)}
                title={`Remove ${color.name}`}
                aria-label={`Remove ${color.name}`}
                className="
                  absolute -top-2 -right-2 w-5 h-5
                  bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full
                  flex items-center justify-center
                  text-zinc-400 hover:text-red-500 hover:border-red-200
                  shadow-sm transition-all duration-150
                  opacity-0 group-hover/swatch:opacity-100
                  scale-75 group-hover/swatch:scale-100
                "
              >
                <X size={9} strokeWidth={2.5} />
              </button>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{color.name}</p>
            <p className="text-[11px] text-zinc-400 font-mono uppercase">{color.hex}</p>
          </div>
        </div>
      ))}

      {/* Add Color button */}
      {colors.length < 8 && (
        <button
          onClick={handleAddColor}
          title="Add a brand colour"
          className="flex flex-col gap-2 group"
        >
          <div className="w-16 h-16 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 group-hover:border-zinc-400 dark:group-hover:border-zinc-500 transition-colors duration-150 flex items-center justify-center text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-400">
            <span className="text-xl leading-none select-none">+</span>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">Add</p>
          </div>
        </button>
      )}

      <p className="self-end text-[11px] text-zinc-400 pb-1 w-full mt-1">
        Click a swatch to edit. Saved locally in your browser.
      </p>
    </div>
  )
}
