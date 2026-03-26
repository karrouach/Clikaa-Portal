'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { MessageSquare, Send, Loader2, User } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { replyToConversation, markConversationRead } from './message-actions'

interface ConvClient {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
}

interface ConvItem {
  id: string
  subject: string
  created_at: string
  updated_at: string
  client: ConvClient | null
  unread_count: number
}

interface MsgItem {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  is_read: boolean
  created_at: string
  sender: { full_name: string | null; email: string; avatar_url: string | null } | null
}

interface Props {
  initialConversations: ConvItem[]
  currentUserId: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function MessagesClient({ initialConversations, currentUserId }: Props) {
  const [conversations, setConversations] = useState<ConvItem[]>(initialConversations)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  )
  const [messages, setMessages] = useState<MsgItem[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [reply, setReply] = useState('')
  const [isPending, startTransition] = useTransition()
  const threadEndRef = useRef<HTMLDivElement>(null)

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null

  // ── Load messages for selected conversation ──────────────────────────────
  useEffect(() => {
    if (!selectedId) return
    setLoadingMsgs(true)

    const supabase = createClient()
    supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, is_read, created_at, sender:profiles!sender_id(full_name, email, avatar_url)')
      .eq('conversation_id', selectedId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages((data ?? []) as MsgItem[])
        setLoadingMsgs(false)
        // Mark as read (fire-and-forget)
        markConversationRead(selectedId)
        // Update local unread count
        setConversations((prev) =>
          prev.map((c) => c.id === selectedId ? { ...c, unread_count: 0 } : c)
        )
      })
  }, [selectedId])

  // ── Scroll to bottom when messages update ────────────────────────────────
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send reply ───────────────────────────────────────────────────────────
  function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId || !reply.trim()) return
    const body = reply.trim()
    setReply('')

    // Optimistic: add to messages immediately
    const optimistic: MsgItem = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedId,
      sender_id: currentUserId,
      body,
      is_read: true,
      created_at: new Date().toISOString(),
      sender: null,
    }
    setMessages((prev) => [...prev, optimistic])

    startTransition(async () => {
      await replyToConversation(selectedId, body)
    })
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] md:h-[calc(100vh-6rem)] overflow-hidden rounded-xl border border-zinc-100 bg-white">

      {/* ── Conversation list ─────────────────────────────────────────────── */}
      <div className={cn(
        'w-full md:w-72 shrink-0 border-r border-zinc-100 flex flex-col',
        selectedId ? 'hidden md:flex' : 'flex'
      )}>
        <div className="px-4 py-3.5 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-black">Inbox</h2>
          <p className="text-xs text-zinc-400">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-50">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-4">
              <MessageSquare size={28} strokeWidth={1} className="text-zinc-200" />
              <p className="text-sm text-zinc-400">No messages yet</p>
              <p className="text-xs text-zinc-300">Client messages will appear here</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const clientName = conv.client?.full_name || conv.client?.email || 'Unknown'
              const initials = getInitials(clientName)
              const isSelected = conv.id === selectedId

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={cn(
                    'w-full text-left px-4 py-3.5 transition-colors hover:bg-zinc-50',
                    isSelected && 'bg-zinc-50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-white text-[10px] font-semibold">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-black truncate">{clientName}</p>
                        <span className="text-[10px] text-zinc-400 shrink-0">{timeAgo(conv.updated_at)}</span>
                      </div>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{conv.subject || 'No subject'}</p>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="shrink-0 w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5" />
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Thread view ──────────────────────────────────────────────────── */}
      {selectedConv ? (
        <div className={cn(
          'flex-1 flex flex-col min-w-0',
          !selectedId ? 'hidden md:flex' : 'flex'
        )}>
          {/* Thread header */}
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-3">
            <button
              className="md:hidden text-zinc-400 hover:text-black p-1"
              onClick={() => setSelectedId(null)}
            >
              ←
            </button>
            <div>
              <p className="text-sm font-semibold text-black">{selectedConv.subject || 'No subject'}</p>
              <p className="text-xs text-zinc-400">
                {selectedConv.client?.full_name || selectedConv.client?.email}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {loadingMsgs ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-zinc-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-zinc-400">No messages in this conversation.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isCurrentUser = msg.sender_id === currentUserId
                const senderName = msg.sender?.full_name || msg.sender?.email || (isCurrentUser ? 'You' : 'Client')
                const initials = getInitials(senderName)

                return (
                  <div key={msg.id} className={cn('flex gap-3', isCurrentUser && 'flex-row-reverse')}>
                    <div className={cn(
                      'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold',
                      isCurrentUser ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-700'
                    )}>
                      {initials || <User size={12} />}
                    </div>
                    <div className={cn('max-w-[70%]', isCurrentUser && 'items-end flex flex-col')}>
                      <div className={cn(
                        'rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
                        isCurrentUser
                          ? 'bg-black text-white rounded-tr-sm'
                          : 'bg-zinc-100 text-zinc-800 rounded-tl-sm'
                      )}>
                        {msg.body}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 px-1">
                        {isCurrentUser ? 'You' : senderName} · {timeAgo(msg.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Reply form */}
          <form onSubmit={handleReply} className="px-5 py-4 border-t border-zinc-100">
            <div className="flex gap-2">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a reply…"
                className="flex-1 h-9 px-3 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 focus:bg-white transition-colors"
                disabled={isPending}
              />
              <button
                type="submit"
                disabled={isPending || !reply.trim()}
                className="h-9 w-9 flex items-center justify-center bg-black text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={1.5} />}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="text-center">
            <MessageSquare size={32} strokeWidth={1} className="text-zinc-200 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">Select a conversation</p>
          </div>
        </div>
      )}
    </div>
  )
}
