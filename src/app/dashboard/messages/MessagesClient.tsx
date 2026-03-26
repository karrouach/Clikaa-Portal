'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { MessageSquare, Send, Loader2, User, Search, X, Plus } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  replyToConversation,
  markConversationRead,
  searchUsersForMessaging,
  adminStartConversation,
} from './message-actions'
import { toast } from 'sonner'

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

interface SearchUser {
  id: string
  full_name: string
  email: string
  role: string
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
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id ?? null)
  const [messages, setMessages] = useState<MsgItem[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [reply, setReply] = useState('')
  const [isPending, startTransition] = useTransition()
  const threadEndRef = useRef<HTMLDivElement>(null)

  // Search / new conversation
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newTarget, setNewTarget] = useState<SearchUser | null>(null)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        markConversationRead(selectedId)
        setConversations((prev) =>
          prev.map((c) => c.id === selectedId ? { ...c, unread_count: 0 } : c)
        )
      })
  }, [selectedId])

  // ── Scroll to bottom ─────────────────────────────────────────────────────
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Realtime: new messages in active thread ──────────────────────────────
  useEffect(() => {
    if (!selectedId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`messages:${selectedId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedId}` },
        async (payload) => {
          const raw = payload.new as MsgItem
          if (raw.sender_id === currentUserId) return
          const { data: senderData } = await supabase
            .from('profiles')
            .select('full_name, email, avatar_url')
            .eq('id', raw.sender_id)
            .single()
          setMessages((prev) => [...prev, { ...raw, sender: senderData ?? null }])
          setConversations((prev) =>
            prev.map((c) => c.id === selectedId ? { ...c, updated_at: raw.created_at } : c)
              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedId, currentUserId])

  // ── Realtime: new conversations appearing in inbox ───────────────────────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin:conversations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        async (payload) => {
          const raw = payload.new as { id: string; client_id: string; subject: string; created_at: string; updated_at: string }
          const { data: clientData } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .eq('id', raw.client_id)
            .single()
          const newConv: ConvItem = {
            id: raw.id,
            subject: raw.subject,
            created_at: raw.created_at,
            updated_at: raw.updated_at,
            client: clientData ?? null,
            unread_count: 1,
          }
          setConversations((prev) => [newConv, ...prev])
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── Realtime: conversation updated_at changes (new replies) ─────────────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin:conversations:updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          const raw = payload.new as { id: string; updated_at: string }
          setConversations((prev) =>
            prev.map((c) => c.id === raw.id ? { ...c, updated_at: raw.updated_at } : c)
              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          )
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── Search debounce ──────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    setSearchLoading(true)
    const results = await searchUsersForMessaging(q)
    setSearchResults(results)
    setSearchLoading(false)
  }, [])

  useEffect(() => {
    if (!searchOpen) return
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => runSearch(searchQuery), 300)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [searchQuery, searchOpen, runSearch])

  // Load initial results when panel opens
  useEffect(() => {
    if (searchOpen) runSearch('')
  }, [searchOpen, runSearch])

  // ── Send reply ───────────────────────────────────────────────────────────
  function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId || !reply.trim()) return
    const body = reply.trim()
    setReply('')
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
      const result = await replyToConversation(selectedId, body)
      if (result?.error) toast.error(result.error)
    })
  }

  // ── Send new conversation ────────────────────────────────────────────────
  function handleNewConversation() {
    if (!newTarget || !newSubject.trim() || !newBody.trim()) return
    startTransition(async () => {
      const result = await adminStartConversation(newTarget.id, newSubject.trim(), newBody.trim())
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Message sent')
      setSearchOpen(false)
      setSearchQuery('')
      setNewTarget(null)
      setNewSubject('')
      setNewBody('')
      setSelectedId(result.id)
    })
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] md:h-[calc(100vh-6rem)] overflow-hidden rounded-xl border border-zinc-100 bg-white">

      {/* ── Conversation list ──────────────────────────────────────────────── */}
      <div className={cn(
        'w-full md:w-72 shrink-0 border-r border-zinc-100 flex flex-col',
        selectedId && !searchOpen ? 'hidden md:flex' : 'flex'
      )}>
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-black">Inbox</h2>
            <p className="text-xs text-zinc-400">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => { setSearchOpen((v) => !v); setNewTarget(null); setSearchQuery('') }}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors"
            title="New message"
          >
            {searchOpen ? <X size={14} strokeWidth={1.5} /> : <Plus size={14} strokeWidth={1.5} />}
          </button>
        </div>

        {/* Search / New message panel */}
        {searchOpen ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-zinc-100">
              <p className="text-xs font-medium text-zinc-500 mb-2">New message to…</p>
              <div className="relative">
                <Search size={13} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clients or designers…"
                  className="w-full h-8 pl-7 pr-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* User results */}
            <div className="flex-1 overflow-y-auto">
              {searchLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-zinc-300" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-zinc-400">No users found</p>
                </div>
              ) : (
                searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setNewTarget(u)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-zinc-50 transition-colors',
                      newTarget?.id === u.id && 'bg-zinc-50'
                    )}
                  >
                    <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center text-white text-[10px] font-semibold">
                      {getInitials(u.full_name || u.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-black truncate">{u.full_name || u.email}</p>
                      <p className="text-[10px] text-zinc-400 capitalize">{u.role}</p>
                    </div>
                    {newTarget?.id === u.id && (
                      <span className="ml-auto w-1.5 h-1.5 bg-black rounded-full shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Compose area */}
            {newTarget && (
              <div className="border-t border-zinc-100 p-3 space-y-2">
                <p className="text-[11px] text-zinc-500">
                  To: <span className="font-medium text-black">{newTarget.full_name || newTarget.email}</span>
                </p>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Subject…"
                  className="w-full h-8 px-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 transition-colors"
                />
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Write a message…"
                  rows={3}
                  className="w-full px-2.5 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 transition-colors resize-none"
                />
                <button
                  onClick={handleNewConversation}
                  disabled={isPending || !newSubject.trim() || !newBody.trim()}
                  className="w-full h-8 flex items-center justify-center gap-1.5 bg-black text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={12} strokeWidth={1.5} />}
                  Send
                </button>
              </div>
            )}
          </div>
        ) : (
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
        )}
      </div>

      {/* ── Thread view ───────────────────────────────────────────────────── */}
      {selectedConv ? (
        <div className={cn(
          'flex-1 flex flex-col min-w-0',
          !selectedId ? 'hidden md:flex' : 'flex'
        )}>
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
