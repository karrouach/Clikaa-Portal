'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addComment } from '@/app/dashboard/comment-actions'
import type { CommentWithAuthor } from '@/types/database'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials, formatRelativeTime } from '@/lib/utils'
import { Send, Loader2 } from 'lucide-react'

interface CommentFeedProps {
  taskId: string
  currentUserProfile: {
    id: string
    full_name: string
    avatar_url: string | null
    email: string
  }
}

/**
 * CommentFeed — self-contained comment thread for a single task.
 *
 * Responsibilities:
 *   1. Fetches the initial comment list on mount (joined with author profiles).
 *   2. Maintains a live Supabase Realtime subscription for new comments.
 *   3. Posts new comments optimistically (instant UI, background persist).
 *   4. Handles the race between optimistic insert and realtime dedup.
 */
export function CommentFeed({ taskId, currentUserProfile }: CommentFeedProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [body, setBody] = useState('')
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── Fetch initial comments + subscribe to realtime ─────────────────────────
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

    // Subscribe to new comments on this task
    const channel = supabase
      .channel(`task:${taskId}:comments`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `task_id=eq.${taskId}`,
        },
        async (payload) => {
          // Fetch the full comment with the author profile join
          const { data } = await supabase
            .from('comments')
            .select('*, profiles (full_name, avatar_url, email)')
            .eq('id', (payload.new as { id: string }).id)
            .single()

          if (data && mounted) {
            setComments((prev) => {
              // Dedup: the optimistic insertion may have already added
              // this comment (matched by real id after server action returned).
              // Also guards against double-fire of the realtime event.
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

  // ── Scroll to bottom when new comments arrive ─────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  // ── Submit handler ─────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || isPending) return

    // Build an optimistic comment with a temporary id
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

    startTransition(async () => {
      const result = await addComment({ taskId, body: trimmed })

      if (result.error) {
        // Roll back on failure — restore body so the user can retry
        setComments((prev) => prev.filter((c) => c.id !== optimisticId))
        setBody(trimmed)
        return
      }

      if (result.comment) {
        // Replace optimistic with the real persisted comment.
        // Also deduplicate in case the realtime event beat us here.
        setComments((prev) => {
          const withReplaced = prev.map((c) =>
            c.id === optimisticId ? result.comment! : c
          )
          // Remove any duplicate that realtime may have added
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

  // Cmd+Enter / Ctrl+Enter to submit
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
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
              comment.profiles?.full_name ||
              comment.profiles?.email ||
              'Unknown'
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
                    {comment.body}
                  </p>
                </div>
              </div>
            )
          })}

          {/* Anchor element to auto-scroll to */}
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
              {getInitials(
                currentUserProfile.full_name || currentUserProfile.email
              )}
            </AvatarFallback>
          </Avatar>

          {/* Textarea */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Add a comment… (⌘↵ to send)"
            disabled={isPending}
            className="
              flex-1 bg-transparent text-sm text-black placeholder:text-zinc-400
              border-0 border-b border-zinc-200 focus:outline-none focus:border-black
              transition-colors duration-150 resize-none py-1
              disabled:opacity-50
            "
            style={{ minHeight: '32px', maxHeight: '120px' }}
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={!body.trim() || isPending}
            className="
              flex items-center justify-center w-7 h-7 mb-0.5 shrink-0
              bg-black text-white
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
