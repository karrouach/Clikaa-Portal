'use client'

import React, { useState, useTransition, useRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import confetti from 'canvas-confetti'
import type { Task, TaskStatus, TaskPriority } from '@/types/database'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { CommentFeed } from './CommentFeed'
import { AttachmentPanel } from './AttachmentPanel'
import { TaskActivityFeed } from './TaskActivityFeed'
import {
  updateTaskStatus,
  updateTaskPriority,
  updateTaskDates,
  updateTaskAssignee,
  updateTaskLinks,
  deleteTask,
} from '@/app/dashboard/task-actions'
import { updateTaskTitle, updateTaskDescription } from '@/app/dashboard/comment-actions'
import { formatDate, getInitials } from '@/lib/utils'
import {
  CheckCircle2,
  Loader2,
  Trash2,
  CalendarIcon,
  User,
  X,
  LayoutGrid,
  Maximize2,
  PanelRight,
  Pencil,
  Link2,
  Plus,
  Share2,
  Flag,
  MoreVertical,
  Bold,
  Italic,
  List,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { MemberOption } from './CreateTaskDialog'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CurrentUserProfile {
  id: string
  role: 'admin' | 'client' | 'designer' | 'developer' | 'marketer' | 'project_manager'
  full_name: string
  avatar_url: string | null
  email: string
}

interface TaskDetailSheetProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserProfile: CurrentUserProfile
  onTaskUpdated: (task: Task) => void
  onTaskDeleted: (taskId: string) => void
  workspaceMembers?: MemberOption[]
}

type LayoutMode = 'modal' | 'fullscreen' | 'sidebar'
const LAYOUT_KEY = 'clikaa_task_layout'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo',        label: 'To Do' },
  { value: 'pending',     label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review',      label: 'Review' },
  { value: 'done',        label: 'Done' },
]

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
]

const PRIORITY_VARIANT = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent',
} as const

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─────────────────────────────────────────────────────────────────────────────
// EditableTitle
// ─────────────────────────────────────────────────────────────────────────────
function EditableTitle({
  taskId,
  value,
  isAdmin,
  onSaved,
}: {
  taskId: string
  value: string
  isAdmin: boolean
  onSaved: (title: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [isPending, startTransition] = useTransition()

  if (!editing && draft !== value) setDraft(value)

  if (!isAdmin) {
    return <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">{value}</h2>
  }

  if (editing) {
    function save() {
      const trimmed = draft.trim()
      if (!trimmed || trimmed === value) { setDraft(value); setEditing(false); return }
      startTransition(async () => {
        const result = await updateTaskTitle({ taskId, title: trimmed })
        if (!result.error && result.task) onSaved(result.task.title)
        else setDraft(value)
        setEditing(false)
      })
    }

    return (
      <div className="relative">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
            if (e.key === 'Escape') { setDraft(value); setEditing(false) }
          }}
          rows={2}
          disabled={isPending}
          style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
          className="w-full bg-transparent text-lg font-semibold text-zinc-900 dark:text-zinc-100 resize-none leading-snug focus:outline-none focus:ring-0 focus:border-transparent focus:bg-transparent px-2 -ml-2 rounded-md transition-colors duration-150 disabled:opacity-60"
        />
        {isPending && <Loader2 size={12} strokeWidth={1.5} className="absolute right-0 top-1 animate-spin text-zinc-400" />}
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} title="Click to edit title" className="flex items-center gap-1.5 w-full text-left group outline-none focus-visible:outline-none">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 leading-snug group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors">
        {value}
      </h2>
      <Pencil size={12} strokeWidth={1.5} className="shrink-0 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RichDescription — parses text for URLs and renders them as inline link pills
// ─────────────────────────────────────────────────────────────────────────────
const URL_RE = /(https?:\/\/[^\s]+)/g

function formatLinkLabel(url: string): string {
  try {
    const { hostname, pathname } = new URL(url)
    const host = hostname.replace(/^www\./, '')
    // Show up to first two path segments for context
    const segments = pathname.split('/').filter(Boolean).slice(0, 2)
    return segments.length ? `${host}/${segments.join('/')}` : host
  } catch {
    return url
  }
}

function getFaviconUrl(url: string): string {
  try {
    const { hostname } = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
  } catch {
    return `https://www.google.com/s2/favicons?domain=${url}&sz=32`
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// formatDescriptionLinks — replaces <a> tags (and bare URLs) in description HTML
// with fully-styled inline pill snippets. contenteditable="false" prevents the
// cursor from getting trapped inside the pill while editing.
// ─────────────────────────────────────────────────────────────────────────────
function formatDescriptionLinks(html: string): string {
  if (!html) return ''

  // Pass 1 — replace existing <a href="..."> tags with styled pills
  let result = html.replace(
    /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1[^>]*>.*?<\/a>/gi,
    (_match, _quote, url: string) => {
      const faviconDomain = (() => { try { return new URL(url).hostname } catch { return url } })()
      const label = formatLinkLabel(url)
      return (
        `<a href="${url}" target="_blank" rel="noopener noreferrer" contenteditable="false" ` +
        `class="inline-flex items-center gap-2 px-3 py-1.5 m-1 bg-gray-50 dark:bg-zinc-800/50 ` +
        `border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 ` +
        `rounded-lg text-sm font-medium !text-gray-900 dark:!text-gray-100 !no-underline transition-colors align-middle shadow-sm">` +
        `<img src="https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=32" ` +
        `class="w-4 h-4 rounded-sm shrink-0" alt="" style="display:inline-block;vertical-align:middle" />` +
        `<span>${label}</span>` +
        `</a>`
      )
    }
  )

  // Pass 2 — wrap bare https?:// URLs not already inside an <a> tag
  result = result.replace(
    /(?<!href=["'])(?<!src=["'])(https?:\/\/[^\s<"']+)/g,
    (url) => {
      const faviconDomain = (() => { try { return new URL(url).hostname } catch { return url } })()
      const label = formatLinkLabel(url)
      return (
        `<a href="${url}" target="_blank" rel="noopener noreferrer" contenteditable="false" ` +
        `class="inline-flex items-center gap-2 px-3 py-1.5 m-1 bg-gray-50 dark:bg-zinc-800/50 ` +
        `border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 ` +
        `rounded-lg text-sm font-medium !text-gray-900 dark:!text-gray-100 !no-underline transition-colors align-middle shadow-sm">` +
        `<img src="https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=32" ` +
        `class="w-4 h-4 rounded-sm shrink-0" alt="" style="display:inline-block;vertical-align:middle" />` +
        `<span>${label}</span>` +
        `</a>`
      )
    }
  )

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// EditableDescription
// ─────────────────────────────────────────────────────────────────────────────
function EditableDescription({
  taskId,
  value,
  canEdit,
  onSaved,
}: {
  taskId: string
  value: string | null
  canEdit: boolean
  onSaved: (description: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  // htmlContent mirrors the contentEditable innerHTML so execCommand changes are captured
  const [htmlContent, setHtmlContent] = useState(value ?? '')
  const [isPending, startTransition] = useTransition()
  const editorRef = React.useRef<HTMLDivElement>(null)

  // Keep htmlContent in sync when the prop changes while not editing
  React.useEffect(() => {
    if (!editing) setHtmlContent(value ?? '')
  }, [value, editing])

  // Populate contentEditable and focus when editing starts
  React.useEffect(() => {
    if (editing && editorRef.current) {
      editorRef.current.innerHTML = formatDescriptionLinks(value ?? '')
      editorRef.current.focus()
      const range = document.createRange()
      const sel = window.getSelection()
      if (sel) {
        range.selectNodeContents(editorRef.current)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }, [editing]) // intentionally excludes value — we only want this on mount of edit mode

  function save() {
    // Use innerText to check for emptiness; save innerHTML to preserve formatting
    const isEmpty = !(editorRef.current?.innerText.trim())
    const toSave = isEmpty ? null : htmlContent
    if (toSave === value) { setEditing(false); return }
    startTransition(async () => {
      await updateTaskDescription({ taskId, description: toSave })
      onSaved(toSave)
      setEditing(false)
    })
  }

  function cancel() {
    setHtmlContent(value ?? '')
    setEditing(false)
  }

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const exec = (cmd: string, arg?: string) => document.execCommand(cmd, false, arg)

  if (!canEdit) {
    return (
      <div className="flex flex-col items-start justify-start text-left bg-gray-50 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden p-4 min-h-[120px] w-full">
        {value
          ? <div
              className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed break-words w-full [&_b]:font-bold [&_i]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5"
              dangerouslySetInnerHTML={{ __html: formatDescriptionLinks(value) }}
            />
          : <p className="text-sm text-zinc-400 italic">No description provided.</p>
        }
      </div>
    )
  }

  if (editing) {

    return (
      <div className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden focus-within:border-zinc-300 dark:focus-within:border-zinc-500 transition-colors duration-150">
        {/* ── Formatting toolbar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-0.5 px-2 pt-2 pb-1.5 border-b border-gray-200 dark:border-zinc-700">
          {([
            { icon: Bold,   title: 'Bold',   cmd: 'bold'                },
            { icon: Italic, title: 'Italic', cmd: 'italic'              },
            { icon: List,   title: 'List',   cmd: 'insertUnorderedList' },
          ] as const).map(({ icon: Icon, title, cmd }) => (
            <button
              key={title}
              type="button"
              title={title}
              onMouseDown={(e) => { e.preventDefault(); exec(cmd) }}
              className="flex items-center justify-center w-6 h-6 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
            >
              <Icon size={12} strokeWidth={1.5} />
            </button>
          ))}
          {/* Link — prompts for URL then wraps selection */}
          <button
            type="button"
            title="Link"
            onMouseDown={(e) => {
              e.preventDefault()
              const url = window.prompt('Enter URL:')
              if (url) exec('createLink', url)
            }}
            className="flex items-center justify-center w-6 h-6 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
          >
            <Link2 size={12} strokeWidth={1.5} />
          </button>
          {isPending && <Loader2 size={11} strokeWidth={1.5} className="ml-auto mr-1 animate-spin text-zinc-400" />}
        </div>

        {/* ── ContentEditable editor ─────────────────────────────────────── */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => setHtmlContent(e.currentTarget.innerHTML)}
          onKeyDown={(e) => { if (e.key === 'Escape') cancel() }}
          data-placeholder="Add a description…"
          style={{ outline: 'none' }}
          className={cn(
            'w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 leading-relaxed px-3 py-2.5',
            'min-h-[100px] h-auto max-h-[350px] overflow-y-auto',
            'outline-none focus:outline-none focus-visible:outline-none ring-0',
            '[&_b]:font-bold [&_i]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5',
            '[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-zinc-400 [&:empty]:before:italic [&:empty]:before:pointer-events-none',
            isPending && 'opacity-60 pointer-events-none',
          )}
        />

        {/* ── Save / Cancel footer ───────────────────────────────────────── */}
        <div className="flex justify-end gap-2 px-2 py-2 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/30">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); cancel() }}
            className="px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); save() }}
            disabled={isPending}
            className="px-3 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-zinc-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex flex-col items-start justify-start text-left w-full bg-gray-50 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden p-4 min-h-[120px] hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors"
    >
      {value
        ? <div
            className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed break-words w-full [&_b]:font-bold [&_i]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: value }}
          />
        : <p className="text-sm text-zinc-400 italic">Add a description…</p>
      }
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EditableLinks — list of URLs (Figma, Notion, GitHub, etc.)
// ─────────────────────────────────────────────────────────────────────────────
function EditableLinks({
  taskId,
  value,
  canEdit,
  onSaved,
}: {
  taskId: string
  value: string[]
  canEdit: boolean
  onSaved: (links: string[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [isPending, startTransition] = useTransition()

  function isFigma(url: string) { return url.includes('figma.com') }

  function getLinkLabel(url: string) {
    try {
      const { hostname } = new URL(url)
      return hostname.replace(/^www\./, '')
    } catch {
      return url
    }
  }

  function handleAdd() {
    const trimmed = draft.trim()
    if (!trimmed) { setAdding(false); return }
    // Prepend https:// if missing
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const next = [...value, url]
    startTransition(async () => {
      await updateTaskLinks({ taskId, links: next })
      onSaved(next)
      setDraft('')
      setAdding(false)
    })
  }

  function handleRemove(idx: number) {
    const next = value.filter((_, i) => i !== idx)
    startTransition(async () => {
      await updateTaskLinks({ taskId, links: next })
      onSaved(next)
    })
  }

  return (
    <div className="space-y-1.5">
      {value.map((url, idx) => (
        <div key={idx} className="group/link flex items-center gap-2">
          {isFigma(url) ? (
            <span className="shrink-0 w-4 h-4 flex items-center justify-center">
              {/* Figma "F" icon */}
              <svg viewBox="0 0 38 57" width="12" height="12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 28.5C19 25.9804 20.0009 23.5641 21.7825 21.7825C23.5641 20.0009 25.9804 19 28.5 19C31.0196 19 33.4359 20.0009 35.2175 21.7825C36.9991 23.5641 38 25.9804 38 28.5C38 31.0196 36.9991 33.4359 35.2175 35.2175C33.4359 36.9991 31.0196 38 28.5 38C25.9804 38 23.5641 36.9991 21.7825 35.2175C20.0009 33.4359 19 31.0196 19 28.5Z" fill="#1ABCFE"/>
                <path d="M0 47.5C0 44.9804 1.00089 42.5641 2.78249 40.7825C4.56408 39.0009 6.98044 38 9.5 38H19V47.5C19 50.0196 17.9991 52.4359 16.2175 54.2175C14.4359 55.9991 12.0196 57 9.5 57C6.98044 57 4.56408 55.9991 2.78249 54.2175C1.00089 52.4359 0 50.0196 0 47.5Z" fill="#0ACF83"/>
                <path d="M19 0V19H28.5C31.0196 19 33.4359 17.9991 35.2175 16.2175C36.9991 14.4359 38 12.0196 38 9.5C38 6.98044 36.9991 4.56408 35.2175 2.78249C33.4359 1.00089 31.0196 0 28.5 0H19Z" fill="#FF7262"/>
                <path d="M0 9.5C0 12.0196 1.00089 14.4359 2.78249 16.2175C4.56408 17.9991 6.98044 19 9.5 19H19V0H9.5C6.98044 0 4.56408 1.00089 2.78249 2.78249C1.00089 4.56408 0 6.98044 0 9.5Z" fill="#F24E1E"/>
                <path d="M0 28.5C0 31.0196 1.00089 33.4359 2.78249 35.2175C4.56408 36.9991 6.98044 38 9.5 38H19V19H9.5C6.98044 19 4.56408 20.0009 2.78249 21.7825C1.00089 23.5641 0 25.9804 0 28.5Z" fill="#A259FF"/>
              </svg>
            </span>
          ) : (
            <Link2 size={12} strokeWidth={1.5} className="shrink-0 text-zinc-400" />
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
          >
            {getLinkLabel(url)}
          </a>
          {canEdit && (
            <button
              onClick={() => handleRemove(idx)}
              disabled={isPending}
              className="opacity-0 group-hover/link:opacity-100 text-zinc-300 hover:text-red-500 transition-all duration-150 shrink-0"
            >
              <X size={11} strokeWidth={2} />
            </button>
          )}
        </div>
      ))}

      {canEdit && (
        adding ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
                if (e.key === 'Escape') { setDraft(''); setAdding(false) }
              }}
              onBlur={handleAdd}
              placeholder="https://figma.com/..."
              disabled={isPending}
              className="flex-1 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1.5 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:border-zinc-400 dark:focus-visible:border-zinc-500 transition-colors duration-150 disabled:opacity-60"
            />
            {isPending && <Loader2 size={11} strokeWidth={1.5} className="animate-spin text-zinc-400 shrink-0" />}
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150"
          >
            <Plus size={11} strokeWidth={2} />
            Add link
          </button>
        )
      )}

      {!canEdit && value.length === 0 && (
        <p className="text-xs text-zinc-400 italic">No links added.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FigmaDesignBlock — smart Figma embed: input when no link, iframe+detach when set
// ─────────────────────────────────────────────────────────────────────────────
function FigmaDesignBlock({
  taskId,
  value,
  canEdit,
  onSaved,
}: {
  taskId: string
  value: string[]
  canEdit: boolean
  onSaved: (links: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [isPending, startTransition] = useTransition()

  const figmaLink = value.find((l) => l.includes('figma.com'))

  function handleAdd() {
    const trimmed = draft.trim()
    if (!trimmed) return
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    // Replace any existing Figma link, keep others
    const next = [...value.filter((l) => !l.includes('figma.com')), url]
    startTransition(async () => {
      await updateTaskLinks({ taskId, links: next })
      onSaved(next)
      setDraft('')
    })
  }

  function handleDetach() {
    const next = value.filter((l) => !l.includes('figma.com'))
    startTransition(async () => {
      await updateTaskLinks({ taskId, links: next })
      onSaved(next)
    })
  }

  if (figmaLink) {
    const iframeSrc = `https://www.figma.com/embed?embed_host=clikaa&url=${encodeURIComponent(figmaLink)}`
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Design</p>
          {canEdit && (
            <button
              type="button"
              onClick={handleDetach}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors duration-150 disabled:opacity-50"
            >
              {isPending
                ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
                : <Trash2 size={11} strokeWidth={1.5} />
              }
              Detach
            </button>
          )}
        </div>
        <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          {/* Loading skeleton shown until iframe paints */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <svg width="24" height="24" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-40">
                <path d="M19 28.5A9.5 9.5 0 1 1 38 28.5A9.5 9.5 0 1 1 19 28.5Z" fill="#1ABCFE"/>
                <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19V57H9.5A9.5 9.5 0 0 1 0 47.5Z" fill="#0ACF83"/>
                <path d="M19 0L9.5 0A9.5 9.5 0 0 0 0 9.5A9.5 9.5 0 0 0 9.5 19H19V0Z" fill="#F24E1E"/>
                <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#A259FF"/>
                <path d="M38 9.5A9.5 9.5 0 0 0 28.5 0H19V19H28.5A9.5 9.5 0 0 0 38 9.5Z" fill="#FF7262"/>
              </svg>
              <span className="text-[11px]">Loading Figma…</span>
            </div>
          </div>
          <iframe
            src={iframeSrc}
            className="relative w-full aspect-video"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    )
  }

  // State 1 — no Figma link: show input
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Design</p>
      {canEdit ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            placeholder="Paste Figma link to embed…"
            disabled={isPending}
            className="flex-1 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:border-zinc-400 dark:focus-visible:border-zinc-500 transition-colors duration-150 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.trim() || isPending}
            className="shrink-0 px-3 py-2 text-xs font-medium bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-zinc-800 dark:hover:bg-gray-200 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> : 'Add'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-zinc-400 italic">No design linked.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PriorityFlag — Flag icon + label, no background pill
// ─────────────────────────────────────────────────────────────────────────────
const PRIORITY_FLAG_CONFIG: Record<TaskPriority, { color: string; label: string }> = {
  urgent: { color: 'text-red-500 dark:text-red-400',         label: 'High'   }, // legacy: treat urgent as High
  high:   { color: 'text-red-500 dark:text-red-400',         label: 'High'   },
  medium: { color: 'text-amber-500 dark:text-amber-400',     label: 'Medium' },
  low:    { color: 'text-emerald-500 dark:text-emerald-400', label: 'Low'    },
}

function PriorityFlag({ priority }: { priority: TaskPriority }) {
  const { color, label } = PRIORITY_FLAG_CONFIG[priority]
  return (
    <div className={cn('flex items-center gap-1.5 text-sm font-medium', color)}>
      <Flag size={14} strokeWidth={2} className="shrink-0" />
      {label}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DatePickerButton — shared date picker trigger button
// ─────────────────────────────────────────────────────────────────────────────
function DatePickerButton({
  label,
  value,
  canEdit,
  onChange,
}: {
  label: string
  value: string | null | undefined
  canEdit: boolean
  onChange: (iso: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? new Date(value) : undefined

  if (!canEdit) {
    return (
      <p className="flex items-center gap-2 px-2 py-1 -ml-2 text-sm text-zinc-700 dark:text-zinc-300">
        <CalendarIcon size={13} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
        {value ? formatDisplayDate(value) : <span className="text-zinc-400 italic">Not set</span>}
      </p>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 w-full px-2 py-1 -ml-2 text-sm rounded-md',
            'bg-transparent border-transparent shadow-none transition-colors duration-150',
            'hover:bg-gray-100 dark:hover:bg-zinc-800',
            'focus-visible:outline-none',
          )}
        >
          <CalendarIcon size={13} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
          <span className={value ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}>
            {value ? formatDisplayDate(value) : `Set ${label}`}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-auto" style={{ zIndex: 9999 }}>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            onChange(d ? toIso(d) : null)
            setOpen(false)
          }}
          initialFocus
        />
        {value && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 px-3 py-2">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
            >
              Clear date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskDetailSheet
// ─────────────────────────────────────────────────────────────────────────────
export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  currentUserProfile,
  onTaskUpdated,
  onTaskDeleted,
  workspaceMembers = [],
}: TaskDetailSheetProps) {
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isApproving, startApproveTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'comments' | 'activities'>('comments')
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null)

  const [mode, setMode] = useState<LayoutMode>(() => {
    if (typeof window === 'undefined') return 'modal'
    return (localStorage.getItem(LAYOUT_KEY) as LayoutMode) ?? 'modal'
  })

  const INTERNAL_ROLES = ['designer', 'developer', 'marketer', 'project_manager']
  const isAdmin        = currentUserProfile.role === 'admin'
  const isClient       = currentUserProfile.role === 'client'
  const isInternalTeam = INTERNAL_ROLES.includes(currentUserProfile.role)
  // Clients/internal team can edit Status only; admins have full edit access
  const canEdit = isAdmin || isClient
  const assignee = task?.assignee_id
    ? workspaceMembers.find((m) => m.id === task.assignee_id) ?? null
    : null

  function handleModeChange(newMode: LayoutMode) {
    setMode(newMode)
    try { localStorage.setItem(LAYOUT_KEY, newMode) } catch { /* ignore */ }
  }

  function handleStatusChange(status: string) {
    if (!task) return
    const newStatus = status as TaskStatus
    const original = task
    onTaskUpdated({ ...task, status: newStatus })
    updateTaskStatus({ taskId: task.id, status: newStatus }).then(({ error }) => {
      if (error) onTaskUpdated(original)
    })
  }

  function handlePriorityChange(priority: string) {
    if (!task) return
    const newPriority = priority as TaskPriority
    const original = task
    onTaskUpdated({ ...task, priority: newPriority })
    updateTaskPriority({ taskId: task.id, priority: newPriority }).then(({ error }) => {
      if (error) onTaskUpdated(original)
    })
  }

  function handleStartDateChange(iso: string | null) {
    if (!task) return
    const original = task
    onTaskUpdated({ ...task, start_date: iso })
    updateTaskDates({ taskId: task.id, startDate: iso, dueDate: task.due_date }).then(({ error }) => {
      if (error) onTaskUpdated(original)
    })
  }

  function handleDueDateChange(iso: string | null) {
    if (!task) return
    const original = task
    onTaskUpdated({ ...task, due_date: iso })
    updateTaskDates({ taskId: task.id, startDate: task.start_date, dueDate: iso }).then(({ error }) => {
      if (error) onTaskUpdated(original)
    })
  }

  function handleAssigneeChange(memberId: string) {
    if (!task) return
    const newAssigneeId = memberId === '__none__' ? null : memberId
    const original = task
    onTaskUpdated({ ...task, assignee_id: newAssigneeId })
    updateTaskAssignee({ taskId: task.id, assigneeId: newAssigneeId }).then(({ error }) => {
      if (error) onTaskUpdated(original)
    })
  }

  function handleApprove() {
    if (!task) return
    const original = task
    onTaskUpdated({ ...task, status: 'done' as TaskStatus })
    startApproveTransition(async () => {
      const { error } = await updateTaskStatus({ taskId: task.id, status: 'done' })
      if (error) { onTaskUpdated(original); return }
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.55 }, colors: ['#000000', '#10b981', '#ffffff', '#71717a', '#f59e0b'] })
    })
  }

  function handleTitleSaved(title: string) {
    if (!task) return
    onTaskUpdated({ ...task, title })
  }

  function handleDescriptionSaved(description: string | null) {
    if (!task) return
    onTaskUpdated({ ...task, description })
  }

  function handleLinksSaved(links: string[]) {
    if (!task) return
    onTaskUpdated({ ...task, links })
  }

  function handleDelete() {
    if (!task) return
    if (!window.confirm('Delete this task? This cannot be undone.')) return
    startDeleteTransition(async () => {
      const { error } = await deleteTask(task.id)
      if (!error) { onTaskDeleted(task.id); onOpenChange(false) }
    })
  }

  // ── Desktop panel positioning (overridden on mobile via CSS !important) ───
  const panelStyle: React.CSSProperties =
    mode === 'modal'
      ? {
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '1152px',
          height: '88vh',
          borderRadius: '16px',
        }
      : mode === 'fullscreen'
      ? {
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          bottom: '1rem',
          left: '1rem',
          borderRadius: '16px',
        }
      : {
          // sidebar — floats with margin from all edges
          position: 'fixed',
          right: '1rem',
          top: '1rem',
          bottom: '1rem',
          left: 'auto',
          height: 'calc(100vh - 2rem)',
          width: '480px',
          maxWidth: 'calc(100vw - 2rem)',
          borderRadius: '16px',
        }

  const selectedMember = task?.assignee_id
    ? workspaceMembers.find((m) => m.id === task.assignee_id)
    : null

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* ── Backdrop ────────────────────────────────────────────────────── */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-overlay-show data-[state=closed]:animate-overlay-hide"
        />

        {/* ── Panel ───────────────────────────────────────────────────────── */}
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            // Animation classes — mobile base + desktop overrides via globals.css
            'task-panel',
            mode === 'modal'      && 'task-panel-modal',
            mode === 'fullscreen' && 'task-panel-fullscreen',
            mode === 'sidebar'    && 'task-panel-sidebar',
            // Base layout
            'fixed z-50 bg-white dark:bg-[#1A1A1A] flex flex-col overflow-hidden',
            'shadow-2xl shadow-black/15 border border-gray-200 dark:border-zinc-800',
            // Mobile fallback positioning (overridden by CSS !important at max-width:767px)
            'left-0 right-0 bottom-0 top-14',
          )}
          style={panelStyle}
        >
          {task ? (
            <>
              {/* ── Header ──────────────────────────────────────────────────── */}
              <div className="flex items-start gap-4 px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-[#1A1A1A]">
                <div className="flex-1 min-w-0">
                  <EditableTitle
                    taskId={task.id}
                    value={task.title}
                    isAdmin={isAdmin}
                    onSaved={handleTitleSaved}
                  />
                </div>

                {/* Controls: layout toggle (desktop) + close */}
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  {/* Layout toggle — desktop only */}
                  <div className="hidden md:flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 gap-0.5">
                    {(
                      [
                        { id: 'modal',      icon: LayoutGrid, title: 'Modal' },
                        { id: 'fullscreen', icon: Maximize2,  title: 'Full screen' },
                        { id: 'sidebar',    icon: PanelRight, title: 'Sidebar' },
                      ] as const
                    ).map(({ id, icon: Icon, title }) => (
                      <button
                        key={id}
                        onClick={() => handleModeChange(id)}
                        title={title}
                        className={cn(
                          'p-1.5 rounded-md transition-all duration-150',
                          mode === id
                            ? 'bg-white dark:bg-zinc-700 shadow-sm text-black dark:text-white'
                            : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                        )}
                      >
                        <Icon size={13} strokeWidth={1.5} />
                      </button>
                    ))}
                  </div>

                  {/* Share — copies deep-link ?taskId= URL to clipboard */}
                  <button
                    type="button"
                    title="Copy link to task"
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}?taskId=${task.id}`
                      navigator.clipboard.writeText(url).then(() => {
                        toast.success('Task link copied!')
                      })
                    }}
                    className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150"
                  >
                    <Share2 size={13} strokeWidth={1.5} />
                    <span className="sr-only">Copy link</span>
                  </button>

                  {/* Kebab menu — Close + Delete */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150"
                      >
                        {isDeleting
                          ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                          : <MoreVertical size={15} strokeWidth={1.5} />
                        }
                        <span className="sr-only">More actions</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DialogPrimitive.Close asChild>
                        <DropdownMenuItem className="cursor-pointer">
                          <X size={13} strokeWidth={1.5} className="mr-2 text-zinc-400" />
                          Close task
                        </DropdownMenuItem>
                      </DialogPrimitive.Close>
                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-950/30"
                          >
                            <Trash2 size={13} strokeWidth={1.5} className="mr-2" />
                            Delete task
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* ── Body ────────────────────────────────────────────────────── */}
              <div className={cn(
                'flex-1 min-h-0 flex',
                mode === 'sidebar'
                  ? 'flex-col overflow-y-auto'
                  : 'flex-col md:flex-row overflow-y-auto md:overflow-hidden',
              )}>

                {/* ── Left / Main pane ──────────────────────────────────────── */}
                <div className={cn(
                  'px-6 py-5 space-y-6',
                  mode !== 'sidebar' && 'flex-1 overflow-visible md:overflow-y-auto md:border-r md:border-zinc-100 dark:md:border-zinc-800',
                  mode === 'sidebar' && 'w-full',
                )}>

                  {/* ── Metadata rows ─────────────────────────────────────── */}
                  <div className="flex flex-col gap-4">

                    {/* Status (col 1) */}
                    <div className="flex items-center gap-4">
                      <span className="w-28 shrink-0 text-xs text-gray-500 dark:text-zinc-500 flex items-center gap-1.5">
                        <LayoutGrid size={11} strokeWidth={1.5} className="shrink-0" />
                        Status
                      </span>
                      <div className="flex-1 min-w-0">
                        <Select value={task.status} onValueChange={handleStatusChange} disabled={!canEdit && !isInternalTeam}>
                          <SelectTrigger className="h-auto bg-transparent border-transparent shadow-none px-2 py-1 -ml-2 w-full text-sm hover:bg-gray-100 dark:hover:bg-zinc-800 hover:border-transparent focus:border-transparent rounded-md [&>svg:last-child]:hidden">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Priority (col 2) */}
                    <div className="flex items-center gap-4">
                      <span className="w-28 shrink-0 text-xs text-gray-500 dark:text-zinc-500 flex items-center gap-1.5">
                        <Flag size={11} strokeWidth={1.5} className="shrink-0" />
                        Priority
                      </span>
                      <div className="flex-1 min-w-0">
                        {canEdit ? (
                          <Select value={task.priority} onValueChange={handlePriorityChange}>
                            <SelectTrigger className="h-auto bg-transparent border-transparent shadow-none px-2 py-1 -ml-2 w-full text-sm hover:bg-gray-100 dark:hover:bg-zinc-800 hover:border-transparent focus:border-transparent rounded-md [&>svg:last-child]:hidden">
                              <SelectValue>
                                <PriorityFlag priority={task.priority} />
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {PRIORITY_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <PriorityFlag priority={opt.value} />
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <PriorityFlag priority={task.priority} />
                        )}
                      </div>
                    </div>

                    {/* Due Date (col 1) */}
                    <div className="flex items-center gap-4">
                      <span className="w-28 shrink-0 text-xs text-gray-500 dark:text-zinc-500 flex items-center gap-1.5">
                        <CalendarIcon size={11} strokeWidth={1.5} className="shrink-0" />
                        Due Date
                      </span>
                      <div className="flex-1 min-w-0">
                        <DatePickerButton
                          label="due date"
                          value={task.due_date}
                          canEdit={canEdit}
                          onChange={handleDueDateChange}
                        />
                      </div>
                    </div>

                    {/* Assignee (col 2) */}
                    <div className="flex items-center gap-4">
                      <span className="w-28 shrink-0 text-xs text-gray-500 dark:text-zinc-500 flex items-center gap-1.5">
                        <User size={11} strokeWidth={1.5} className="shrink-0" />
                        Assignee
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Assigned member avatar — click to swap */}
                          {isAdmin && workspaceMembers.length > 0 ? (
                            <>
                              {selectedMember && (
                                <div className="flex -space-x-2">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button type="button" title={`Swap ${selectedMember.full_name || selectedMember.email}`} className="rounded-full ring-2 ring-white dark:ring-[#1A1A1A] focus:outline-none">
                                        {selectedMember.avatar_url ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={selectedMember.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                                        ) : (
                                          <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                                            <span className="text-[9px] font-medium text-zinc-600 dark:text-zinc-300">{getInitials(selectedMember.full_name || selectedMember.email)}</span>
                                          </div>
                                        )}
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-48">
                                      <DropdownMenuLabel className="text-[10px] text-zinc-400 uppercase tracking-widest px-2 py-1">Swap assignee</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleAssigneeChange('__none__')} className="cursor-pointer">
                                        <span className="text-zinc-400">Remove assignee</span>
                                      </DropdownMenuItem>
                                      {workspaceMembers.filter((m) => m.id !== selectedMember.id).map((m) => (
                                        <DropdownMenuItem key={m.id} onClick={() => handleAssigneeChange(m.id)} className="cursor-pointer">
                                          <div className="flex items-center gap-2">
                                            {m.avatar_url ? (
                                              // eslint-disable-next-line @next/next/no-img-element
                                              <img src={m.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover shrink-0" />
                                            ) : (
                                              <div className="h-5 w-5 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                                                <span className="text-[8px] font-medium text-zinc-600 dark:text-zinc-300">{getInitials(m.full_name || m.email)}</span>
                                              </div>
                                            )}
                                            <span className="text-sm">{m.full_name || m.email}</span>
                                          </div>
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )}

                              {/* + Add button */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    title="Add assignee"
                                    className="w-7 h-7 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                                  >
                                    <Plus size={11} strokeWidth={2.5} />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-48">
                                  <DropdownMenuLabel className="text-[10px] text-zinc-400 uppercase tracking-widest px-2 py-1">Assign member</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {workspaceMembers.map((m) => (
                                    <DropdownMenuItem key={m.id} onClick={() => handleAssigneeChange(m.id)} className="cursor-pointer">
                                      <div className="flex items-center gap-2">
                                        {m.avatar_url ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={m.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover shrink-0" />
                                        ) : (
                                          <div className="h-5 w-5 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                                            <span className="text-[8px] font-medium text-zinc-600 dark:text-zinc-300">{getInitials(m.full_name || m.email)}</span>
                                          </div>
                                        )}
                                        <span className="text-sm">{m.full_name || m.email}</span>
                                      </div>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </>
                          ) : task.assignee_id && assignee ? (
                            <div className="flex items-center gap-2">
                              {assignee.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={assignee.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                                  <span className="text-[9px] font-medium text-zinc-600 dark:text-zinc-300">{getInitials(assignee.full_name || assignee.email)}</span>
                                </div>
                              )}
                              <span className="text-sm text-zinc-700 dark:text-zinc-300">{assignee.full_name || assignee.email}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-zinc-400 italic">Unassigned</span>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Client: Approve Design */}
                  {isClient && task.status === 'review' && (
                    <button
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="w-full h-11 flex items-center justify-center gap-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-zinc-800 active:bg-zinc-900 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isApproving
                        ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                        : <CheckCircle2 size={16} strokeWidth={1.5} />
                      }
                      {isApproving ? 'Approving…' : 'Approve Design'}
                    </button>
                  )}

                  {/* Description */}
                  <div className="space-y-1.5 group/desc">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Description</p>
                      {canEdit && (
                        <Pencil
                          size={10}
                          strokeWidth={1.5}
                          className="text-zinc-300 opacity-0 group-hover/desc:opacity-100 transition-opacity"
                        />
                      )}
                    </div>
                    <EditableDescription
                      taskId={task.id}
                      value={task.description}
                      canEdit={canEdit}
                      onSaved={handleDescriptionSaved}
                    />

                    {/* Link cards — stacked, favicon + domain, matches reference screenshot */}
                    {(task.links ?? []).filter((l) => !l.includes('figma.com')).length > 0 && (
                      <div className="flex flex-col gap-2 mt-3">
                        {(task.links ?? []).filter((l) => !l.includes('figma.com')).map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 rounded-xl shadow-sm hover:shadow-md transition-all duration-150 no-underline w-full max-w-xs"
                          >
                            {/* Favicon in a small icon box */}
                            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={getFaviconUrl(url)}
                                alt=""
                                width={20}
                                height={20}
                                className="w-5 h-5"
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                              {formatLinkLabel(url)}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Design — smart Figma block */}
                  <FigmaDesignBlock
                    taskId={task.id}
                    value={task.links ?? []}
                    canEdit={canEdit}
                    onSaved={handleLinksSaved}
                  />

                  {/* Attachments */}
                  <div className="space-y-2">
                    <AttachmentPanel
                      taskId={task.id}
                      workspaceId={task.workspace_id}
                      currentUserProfile={currentUserProfile}
                    />
                  </div>

                </div>

                {/* ── Right / Tabbed pane ───────────────────────────────────── */}
                <div className={cn(
                  'flex flex-col bg-[#F9FAFB] dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800',
                  mode !== 'sidebar' && 'md:w-[360px] md:shrink-0 md:border-t-0',
                  mode === 'sidebar' && 'w-full',
                )}>
                  {/* ── Activity header + tabs ────────────────────────────── */}
                  <div className="sticky top-0 z-10 bg-[#F9FAFB] dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-6 pt-4 shrink-0">
                    <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest mb-3">Activity</p>
                    <div className="flex items-end">
                    {(
                      [
                        { id: 'comments',   label: 'Comments' },
                        { id: 'activities', label: 'History'  },
                      ] as const
                    ).map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={cn(
                          'mr-5 pb-2.5 text-xs font-medium border-b-2 transition-colors duration-150 whitespace-nowrap',
                          activeTab === id
                            ? 'border-black dark:border-white text-black dark:text-white -mb-px'
                            : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                    </div>
                  </div>

                  {/* ── Tab body ──────────────────────────────────────────── */}
                  <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                    {activeTab === 'comments' ? (
                      <CommentFeed
                        taskId={task.id}
                        currentUserProfile={currentUserProfile}
                        members={workspaceMembers}
                        inputRef={commentInputRef}
                      />
                    ) : (
                      <TaskActivityFeed taskId={task.id} />
                    )}
                  </div>
                </div>

              </div>
            </>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
