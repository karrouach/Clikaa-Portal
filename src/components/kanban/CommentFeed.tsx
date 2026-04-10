'use client'

import React, { useState, useEffect, useRef, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addComment, updateCommentReactions } from '@/app/dashboard/comment-actions'
import type { CommentWithAuthor } from '@/types/database'
import type { MemberOption } from './CreateTaskDialog'
import { Textarea } from '@/components/ui/textarea'
import { getInitials, formatRelativeTime } from '@/lib/utils'
import { Send, Loader2, Paperclip, CornerUpLeft, SmilePlus, X } from 'lucide-react'

// ─── Mention format: @[Display Name](uuid) ───────────────────────────────────
const MENTION_RE = /(@\[[^\]]+\]\([a-f0-9-]{36}\))/g

function parseMentions(body: string) {
  return body.split(MENTION_RE).map((part, i) => {
    const match = part.match(/^@\[([^\]]+)\]\(([a-f0-9-]{36})\)$/)
    if (match) {
      return (
        <span key={i} className="font-medium text-blue-500 dark:text-blue-400">
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
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
}

const EMOJI_PICKER = ['🔥', '❤️', '🎉', '👀', '😂'] as const

/**
 * CommentFeed — threaded comment feed with @mention support and persisted emoji reactions.
 *
 * - 1-level deep threading: replies nest under the parent comment.
 * - Reactions persist to the database via updateCommentReactions server action.
 * - Reply button sets replyingTo state and focuses the input.
 */
export function CommentFeed({ taskId, currentUserProfile, members = [], inputRef: externalInputRef }: CommentFeedProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pickerOpenId, setPickerOpenId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null)
  // visibleBody: what the textarea displays (@Name format)
  // mentionMap: name → uuid for all inserted mentions (used to rebuild raw body on submit)
  const [visibleBody, setVisibleBody] = useState('')
  const mentionMapRef = useRef<Map<string, string>>(new Map())
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Merge external ref (passed from parent) with internal ref
  const resolvedInputRef = externalInputRef ?? textareaRef

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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'comments', filter: `task_id=eq.${taskId}` },
        (payload) => {
          if (mounted) {
            setComments((prev) =>
              prev.map((c) =>
                c.id === (payload.new as { id: string }).id
                  ? { ...c, reactions: (payload.new as CommentWithAuthor).reactions }
                  : c
              )
            )
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

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  // Resize on mount so placeholder never gets clipped
  useEffect(() => { autoResize() }, [])

  // ── Build raw body (with @[Name](uuid) format) from visibleBody ─────────────
  function buildRawBody(visible: string): string {
    // Sort by name length descending so longer names are replaced first (greedy)
    const names = [...mentionMapRef.current.keys()].sort((a, b) => b.length - a.length)
    let raw = visible
    for (const name of names) {
      const id = mentionMapRef.current.get(name)!
      raw = raw.split(`@${name}`).join(`@[${name}](${id})`)
    }
    return raw
  }

  // ── @mention detection ────────────────────────────────────────────────────
  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setVisibleBody(val)
    autoResize()

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
    const cursor = textareaRef.current?.selectionStart ?? visibleBody.length
    const name = member.full_name || member.email
    // Register mention in map for raw-body reconstruction on submit
    mentionMapRef.current.set(name, member.id)
    const tag = `@${name} `
    const newBody = visibleBody.slice(0, mentionAtIndex) + tag + visibleBody.slice(cursor)
    setVisibleBody(newBody)
    setMentionQuery(null)
    setTimeout(() => {
      textareaRef.current?.focus()
      const pos = mentionAtIndex + tag.length
      textareaRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function submitComment() {
    const trimmedVisible = visibleBody.trim()
    if (!trimmedVisible || isPending) return

    const rawBody = buildRawBody(trimmedVisible)
    const parentId = replyingTo?.id ?? null

    const optimisticId = `optimistic-${Date.now()}`
    const optimistic: CommentWithAuthor = {
      id: optimisticId,
      task_id: taskId,
      author_id: currentUserProfile.id,
      body: rawBody,
      parent_id: parentId,
      reactions: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles: {
        full_name: currentUserProfile.full_name,
        avatar_url: currentUserProfile.avatar_url,
        email: currentUserProfile.email,
      },
    }

    setComments((prev) => [...prev, optimistic])
    setVisibleBody('')
    setReplyingTo(null)
    setMentionQuery(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    startTransition(async () => {
      const result = await addComment({ taskId, body: rawBody, parentId })

      if (result.error) {
        setComments((prev) => prev.filter((c) => c.id !== optimisticId))
        setVisibleBody(trimmedVisible)
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    submitComment()
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
      submitComment()
    }
  }

  function handleCommentFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    // TODO: wire to comment attachment upload
    e.target.value = ''
  }

  // ── Reply: set replyingTo, enforce 1-level depth ──────────────────────────
  function handleReply(comment: CommentWithAuthor) {
    // If this comment is itself a reply, target its parent to keep threads 1-level deep
    const rootId = comment.parent_id ?? comment.id
    const authorName = comment.profiles?.full_name || comment.profiles?.email || 'User'
    setReplyingTo({ id: rootId, name: authorName })
    setTimeout(() => {
      const el = resolvedInputRef.current ?? textareaRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
      }
      autoResize()
    }, 0)
  }

  // ── Reactions: optimistic update + persist ────────────────────────────────
  function handleToggleReaction(commentId: string, emoji: string) {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c
        const current = c.reactions ?? {}
        const users: string[] = current[emoji] ?? []
        const hasReacted = users.includes(currentUserProfile.id)
        const nextUsers = hasReacted
          ? users.filter((uid) => uid !== currentUserProfile.id)
          : [...users, currentUserProfile.id]
        const next = { ...current }
        if (nextUsers.length === 0) delete next[emoji]
        else next[emoji] = nextUsers
        // Persist in background — ignore errors silently (optimistic already applied)
        updateCommentReactions({ commentId, reactions: next }).catch(() => {})
        return { ...c, reactions: next }
      })
    )
  }

  // ── Group comments into threads ───────────────────────────────────────────
  const rootComments = comments.filter((c) => !c.parent_id)
  const repliesByParent = comments.reduce<Record<string, CommentWithAuthor[]>>((acc, c) => {
    if (c.parent_id) {
      acc[c.parent_id] = [...(acc[c.parent_id] ?? []), c]
    }
    return acc
  }, {})

  // ── Render a single comment row ───────────────────────────────────────────
  function renderComment(comment: CommentWithAuthor, isReply = false) {
    const name = comment.profiles?.full_name || comment.profiles?.email || 'Unknown'
    const isMe = comment.author_id === currentUserProfile.id
    const reactions = comment.reactions ?? {}
    const hasReactions = Object.keys(reactions).length > 0

    return (
      <div
        key={comment.id}
        className={isReply ? 'ml-10 mt-3 pl-4 border-l-2 border-gray-200 dark:border-zinc-700' : ''}
      >
        <div className="flex gap-2.5">
          {comment.profiles?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={comment.profiles.avatar_url} alt={name} className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[9px] font-medium text-zinc-600 dark:text-zinc-300">{getInitials(name)}</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-medium text-black dark:text-white leading-none">
                {isMe ? 'You' : name}
              </span>
              <span className="text-[10px] text-zinc-400 tabular-nums leading-none">
                {formatRelativeTime(comment.created_at)}
              </span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed break-words whitespace-pre-wrap">
              {parseMentions(comment.body)}
            </p>

            {/* Persisted reactions display */}
            {hasReactions && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(reactions).map(([emoji, users]) => {
                  const iReacted = users.includes(currentUserProfile.id)
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleToggleReaction(comment.id, emoji)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                        iReacted
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                          : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      <span>{emoji}</span>
                      <span className="tabular-nums">{users.length}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Action bar */}
            <div className="relative flex items-center gap-2 mt-2">
              {/* Reply */}
              <button
                type="button"
                title="Reply"
                onClick={() => handleReply(comment)}
                className="flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <CornerUpLeft size={12} strokeWidth={1.5} />
              </button>

              {/* Thumbs up — quick reaction shortcut */}
              <button
                type="button"
                title="Like"
                onClick={() => handleToggleReaction(comment.id, '👍')}
                className={`flex items-center justify-center w-6 h-6 rounded text-sm transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 ${
                  (reactions['👍'] ?? []).includes(currentUserProfile.id)
                    ? 'opacity-100'
                    : 'opacity-50 hover:opacity-100'
                }`}
              >
                👍
              </button>

              {/* Emoji picker toggle */}
              <button
                type="button"
                title="React"
                onClick={() => setPickerOpenId(pickerOpenId === comment.id ? null : comment.id)}
                className="flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <SmilePlus size={12} strokeWidth={1.5} />
              </button>

              {/* Emoji picker popover */}
              {pickerOpenId === comment.id && (
                <div className="absolute left-0 bottom-8 z-50 flex items-center gap-1 px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg shadow-black/10">
                  {EMOJI_PICKER.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        handleToggleReaction(comment.id, emoji)
                        setPickerOpenId(null)
                      }}
                      className="text-base w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Comment input ─────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="w-full mb-4">
        <div className="w-full">
            <div className="relative border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 focus-within:border-zinc-300 dark:focus-within:border-zinc-600 focus-within:ring-0 focus-within:outline-none focus-within:shadow-none transition-colors duration-150">
              {/* @mention dropdown */}
              {mentionQuery !== null && mentionMatches.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1.5 w-56 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg shadow-black/5 z-50 overflow-hidden">
                  <p className="px-3 pt-2 pb-1 text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                    Members
                  </p>
                  {mentionMatches.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); insertMention(m) }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        i === mentionHighlight ? 'bg-zinc-50 dark:bg-zinc-700' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-600 flex items-center justify-center shrink-0">
                          <span className="text-[8px] font-medium text-zinc-600 dark:text-zinc-300">{getInitials(m.full_name || m.email)}</span>
                        </div>
                      )}
                      <span className="text-sm text-black dark:text-white truncate">
                        {m.full_name || m.email}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Replying-to indicator */}
              {replyingTo && (
                <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                  <span className="text-[11px] text-zinc-400">
                    Replying to <span className="font-medium text-zinc-600 dark:text-zinc-300">{replyingTo.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="ml-auto text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    <X size={11} strokeWidth={2} />
                  </button>
                </div>
              )}

              {/* Textarea */}
              <Textarea
                ref={textareaRef}
                value={visibleBody}
                onChange={handleBodyChange}
                onKeyDown={handleKeyDown}
                placeholder={members.length > 0 ? 'Add a comment… @ to mention' : 'Add a comment…'}
                disabled={isPending}
                className="border-0 bg-transparent rounded-xl shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none p-3 pb-1 resize-none text-sm min-h-[44px] text-zinc-900 dark:text-white placeholder:text-zinc-400"
              />

              {/* Bottom bar: quick chips + send */}
              <div className="flex items-center justify-between px-2.5 pb-2 pt-1 gap-2">
                {/* Quick-insert chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['Status update…', 'Thanks!', 'Approved ✓'] as const).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      disabled={isPending}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setVisibleBody((prev) => (prev ? prev + ' ' + chip : chip))
                        setTimeout(() => {
                          autoResize()
                          textareaRef.current?.focus()
                        }, 0)
                      }}
                      className="px-2 py-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-full transition-colors duration-150 disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Paperclip + Send — grouped on the right */}
                <div className="flex items-center gap-2 shrink-0">
                  <label
                    htmlFor="comment-upload"
                    title="Attach file"
                    className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors duration-150 cursor-pointer"
                  >
                    <Paperclip size={13} strokeWidth={1.5} />
                    <span className="sr-only">Attach file</span>
                  </label>
                  <input
                    type="file"
                    id="comment-upload"
                    className="hidden"
                    onChange={handleCommentFileUpload}
                  />

                  <button
                    type="submit"
                    disabled={!visibleBody.trim() || isPending}
                    className="flex items-center justify-center w-7 h-7 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-zinc-800 dark:hover:bg-gray-200 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isPending ? (
                      <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                    ) : (
                      <Send size={12} strokeWidth={1.5} />
                    )}
                    <span className="sr-only">Send comment</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Microcopy hint */}
            <p className="mt-1.5 px-1 text-[11px] text-zinc-400">
              Pro tip: press <kbd className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-700 dark:text-zinc-300 rounded text-[10px] font-mono">⌘↵</kbd> to send
            </p>
        </div>
      </form>

      {/* ── Comment list ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} strokeWidth={1.5} className="text-zinc-300 animate-spin" />
        </div>
      ) : rootComments.length === 0 ? (
        <p className="text-xs text-zinc-400 py-2">
          No comments yet. Be the first to leave one.
        </p>
      ) : (
        <div className="space-y-5">
          {rootComments.map((comment) => (
            <div key={comment.id}>
              {renderComment(comment, false)}
              {/* Replies nested under parent */}
              {(repliesByParent[comment.id] ?? []).map((reply) =>
                renderComment(reply, true)
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

    </div>
  )
}
