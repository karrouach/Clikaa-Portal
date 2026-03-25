'use client'

import React, { useState, useEffect, useRef, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addComment } from '@/app/dashboard/comment-actions'
import type { CommentWithAuthor } from '@/types/database'
import type { MemberOption } from './CreateTaskDialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { getInitials, formatRelativeTime } from '@/lib/utils'
import { Send, Loader2 } from 'lucide-react'

// ─── Mention format: @[Display Name](uuid) ───────────────────────────────────
const MENTION_RE = /(@\[[^\]]+\]\([a-f0-9-]{36}\))/g

function parseMentions(body: string) {
  return body.split(MENTION_RE).map((part, i) => {
    const match = part.match(/^@\[([^\]]+)\]\(([a-f0-9-]{36})\)$/)
    if (match) {
      return (
        <span key={i} className="font-semibold text-black">
          @{match[1]}
        </span>
      )
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CommentFeedProps {
  taskId: string
  currentUserProfile: {
    id: string
    full_name: string
    avatar_url: string | null
    email: string
  }
  members?: MemberOption[]
}

/**
 * CommentFeed — self-contained comment thread with @mention support.
 *
 * Type @ in the input to trigger a member picker dropdown.
 * Mentions are stored as @[Name](uuid) and rendered highlighted.
 */
export function CommentFeed({ taskId, currentUserProfile, members = [] }: CommentFeedProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [body, setBody] = useState('')
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionAtIndex, setMentionAtIndex] = useState(0)
  const [mentionHighlight, setMentionHighlight] = useState(0)

  // ── Filtered mention candidates ───────────────────────────────────────────
  const mentionMatches =
    mentionQuery !== null && members.length > 0
      ? members
          .filter((m) =>
            (m.full_name || m.email)
              .toLowerCase()
              .includes(mentionQuery.toLowerCase())
          )
          .slice(0, 6)
      : []

  // ── Fetch + realtime ──────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function fetchInitial() {
      const { data } = await supabase
        .from('comments')
        .select('*, profiles (full_name, avatar_url, email)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

      if (mounted) {
        setComments((data as unknown as CommentWithAuthor[]) ?? [])
        setIsLoading(false)
      }
    }

    fetchInitial()

    const channel = supabase
      .channel(`task:${taskId}:comments`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `task_id=eq.${taskId}` },
        async (payload) => {
          const { data } = await supabase
            .from('comments')
            .select('*, profiles (full_name, avatar_url, email)')
            .eq('id', (payload.new as { id: string }).id)
            .single()

          if (data && mounted) {
            setComments((prev) => {
              if (prev.some((c) => c.id === (data as { id: string }).id)) return prev
              return [...prev, data as unknown as CommentWithAuthor]
            })
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [taskId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  // ── @mention detection ────────────────────────────────────────────────────
  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setBody(val)

    const cursor = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const match = before.match(/@([^\s@]*)$/)
    if (match) {
      setMentionQuery(match[1])
      setMentionAtIndex(before.lastIndexOf('@'))
      setMentionHighlight(0)
    } else {
      setMentionQuery(null)
    }
  }

  function insertMention(member: MemberOption) {
    const cursor = textareaRef.current?.selectionStart ?? body.length
    const tag = `@[${member.full_name || member.email}](${member.id}) `
    const newBody = body.slice(0, mentionAtIndex) + tag + body.slice(cursor)
    setBody(newBody)
    setMentionQuery(null)
    setTimeout(() => {
      textareaRef.current?.focus()
      const pos = mentionAtIndex + tag.length
      textareaRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || isPending) return

    const optimisticId = `optimistic-${Date.now()}`
    const optimistic: CommentWithAuthor = {
      id: optimisticId,
      task_id: taskId,
      author_id: currentUserProfile.id,
      body: trimmed,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles: {
        full_name: currentUserProfile.full_name,
        avatar_url: currentUserProfile.avatar_url,
        email: currentUserProfile.email,
      },
    }

    setComments((prev) => [...prev, optimistic])
    setBody('')
    setMentionQuery(null)

    startTransition(async () => {
      const result = await addComment({ taskId, body: trimmed })

      if (result.error) {
        setComments((prev) => prev.filter((c) => c.id !== optimisticId))
        setBody(trimmed)
        return
      }

      if (result.comment) {
        setComments((prev) => {
          const withReplaced = prev.map((c) =>
            c.id === optimisticId ? result.comment! : c
          )
          const seen = new Set<string>()
          return withReplaced.filter((c) => {
            if (seen.has(c.id)) return false
            seen.add(c.id)
            return true
          })
        })
      }
    })
  }

  // ── Keyboard handler ──────────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // @mention navigation
    if (mentionQuery !== null && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionHighlight((h) => (h + 1) % mentionMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionHighlight((h) => (h - 1 + mentionMatches.length) % mentionMatches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(mentionMatches[mentionHighlight])
        return
      }
      if (e.key === 'Escape') {
        setMentionQuery(null)
        return
      }
    }

    // Cmd+Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Comment list ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} strokeWidth={1.5} className="text-zinc-300 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-zinc-400 py-2">
          No comments yet. Be the first to leave one.
        </p>
      ) : (
        <div className="space-y-5">
          {comments.map((comment) => {
            const name =
              comment.profiles?.full_name || comment.profiles?.email || 'Unknown'
            const isMe = comment.author_id === currentUserProfile.id

            return (
              <div key={comment.id} className="flex gap-2.5">
                <Avatar className="w-6 h-6 shrink-0 mt-0.5">
                  <AvatarImage src={comment.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[9px] bg-zinc-100 text-zinc-600">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-medium text-black leading-none">
                      {isMe ? 'You' : name}
                    </span>
                    <span className="text-[10px] text-zinc-400 tabular-nums leading-none">
                      {formatRelativeTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 leading-relaxed break-words whitespace-pre-wrap">
                    {parseMentions(comment.body)}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── Comment input ─────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="pt-3 border-t border-zinc-100">
        <div className="flex items-end gap-2">
          {/* Current user avatar */}
          <Avatar className="w-6 h-6 shrink-0 mb-0.5">
            <AvatarImage src={currentUserProfile.avatar_url ?? undefined} />
            <AvatarFallback className="text-[9px] bg-zinc-100 text-zinc-600">
              {getInitials(currentUserProfile.full_name || currentUserProfile.email)}
            </AvatarFallback>
          </Avatar>

          {/* Textarea wrapper — relative so mention dropdown can be positioned */}
          <div className="relative flex-1">
            {/* @mention dropdown */}
            {mentionQuery !== null && mentionMatches.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1.5 w-56 bg-white border border-zinc-200 rounded-xl shadow-lg shadow-black/5 z-50 overflow-hidden">
                <p className="px-3 pt-2 pb-1 text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                  Members
                </p>
                {mentionMatches.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertMention(m) }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                      i === mentionHighlight ? 'bg-zinc-50' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <Avatar className="w-5 h-5 shrink-0">
                      {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                      <AvatarFallback className="text-[8px] bg-zinc-100 text-zinc-600">
                        {getInitials(m.full_name || m.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-black truncate">
                      {m.full_name || m.email}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <Textarea
              ref={textareaRef}
              value={body}
              onChange={handleBodyChange}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={members.length > 0 ? 'Add a comment… @ to mention (⌘↵ to send)' : 'Add a comment… (⌘↵ to send)'}
              disabled={isPending}
              underline
              className="py-1"
              style={{ minHeight: '32px', maxHeight: '120px' }}
            />
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={!body.trim() || isPending}
            className="
              flex items-center justify-center w-7 h-7 mb-0.5 shrink-0
              bg-black text-white rounded-lg
              hover:bg-zinc-800 transition-colors duration-150
              disabled:opacity-30 disabled:cursor-not-allowed
            "
          >
            {isPending ? (
              <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <Send size={12} strokeWidth={1.5} />
            )}
            <span className="sr-only">Send comment</span>
          </button>
        </div>
      </form>
    </div>
  )
}
