'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { MessageSquare, Send, Loader2, ChevronLeft, Search, X, Plus, Paperclip, Archive, Inbox } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/client'
import { sendMessageReply, markConversationRead, searchUsersForMessaging, sendNewMessage, toggleArchiveConversation } from './message-actions'
import { toast } from 'sonner'

interface ConvItem {
  id: string
  subject: string
  created_at: string
  updated_at: string
  unread_count: number
  archived: boolean
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
  adminName: string
  adminAvatarUrl?: string | null
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

export function ClientMessagesClient({ initialConversations, currentUserId, adminName, adminAvatarUrl }: Props) {
  const [conversations, setConversations] = useState<ConvItem[]>(
    initialConversations.map((c) => ({ ...c, archived: c.archived ?? false }))
  )
  const [selectedId, setSelectedId]       = useState<string | null>(initialConversations[0]?.id ?? null)
  const [messages, setMessages]           = useState<MsgItem[]>([])
  const [loadingMsgs, setLoadingMsgs]     = useState(false)
  const [reply, setReply]                 = useState('')
  const [isPending, startTransition]      = useTransition()
  const [attachFile, setAttachFile]       = useState<File | null>(null)
  const [uploading, setUploading]         = useState(false)
  const attachRef  = useRef<HTMLInputElement>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)

  // ── Inbox search & filter ─────────────────────────────────────────────────
  const [inboxSearch, setInboxSearch] = useState('')
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'archived'>('all')

  // ── New message panel ─────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen]       = useState(false)
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [newSubject, setNewSubject]       = useState('')
  const [newBody, setNewBody]             = useState('')
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => { if (searchOpen) runSearch('') }, [searchOpen, runSearch])

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null

  // ── Filtered conversation list ────────────────────────────────────────────
  const displayedConversations = conversations.filter((c) => {
    const subject = (c.subject || '').toLowerCase()
    const q = inboxSearch.toLowerCase()
    const matchesSearch = !q || subject.includes(q)
    const matchesFilter =
      inboxFilter === 'unread'   ? c.unread_count > 0 && !c.archived :
      inboxFilter === 'archived' ? c.archived :
      !c.archived // 'all' hides archived threads
    return matchesSearch && matchesFilter
  })

  // ── Load messages for selected conversation ───────────────────────────────
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

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── selectedId ref — lets the realtime callback read current value ────────
  const selectedIdRef = useRef(selectedId)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const channel = supabase
      .channel('realtime:client-portal')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const raw = payload.new as MsgItem
          if (raw.sender_id === currentUserId) return

          if (raw.conversation_id === selectedIdRef.current) {
            const { data: senderData } = await supabase
              .from('profiles')
              .select('full_name, email, avatar_url')
              .eq('id', raw.sender_id)
              .single()
            setMessages((prevMessages) => [...prevMessages, { ...raw, sender: senderData ?? null }])
          }
          setConversations((prev) =>
            prev
              .map((c) => c.id === raw.conversation_id
                ? {
                    ...c,
                    updated_at: raw.created_at,
                    unread_count: c.id === selectedIdRef.current ? c.unread_count : c.unread_count + 1,
                  }
                : c
              )
              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          const raw = payload.new as { id: string; updated_at: string; archived: boolean }
          setConversations((prev) =>
            prev
              .map((c) => c.id === raw.id
                ? { ...c, updated_at: raw.updated_at, archived: raw.archived ?? c.archived }
                : c
              )
              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUserId])

  // ── File upload helper ────────────────────────────────────────────────────
  async function uploadAttachment(convId: string): Promise<string | null> {
    if (!attachFile) return null
    setUploading(true)
    try {
      const { createClient: mkClient } = await import('@/lib/supabase/client')
      const sb = mkClient()
      const safeName = attachFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${convId}/${Date.now()}-${safeName}`
      const { error } = await sb.storage.from('message-attachments').upload(path, attachFile, { contentType: attachFile.type })
      if (error) { toast.error('File upload failed'); return null }
      const { data: signed } = await sb.storage.from('message-attachments').createSignedUrl(path, 60 * 60 * 24 * 7)
      setAttachFile(null)
      if (attachRef.current) attachRef.current.value = ''
      return signed?.signedUrl ? `\n📎 [${attachFile.name}](${signed.signedUrl})` : null
    } finally {
      setUploading(false)
    }
  }

  // ── Send reply ────────────────────────────────────────────────────────────
  function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId || (!reply.trim() && !attachFile)) return
    const textBody = reply.trim()
    setReply('')
    startTransition(async () => {
      const attachment = await uploadAttachment(selectedId)
      const body = textBody + (attachment ?? '')
      if (!body.trim()) return
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
      const result = await sendMessageReply(selectedId, body)
      if (result?.error) toast.error(result.error)
    })
  }

  // ── Start new conversation ────────────────────────────────────────────────
  function handleNewConversation() {
    if (!newSubject.trim() || !newBody.trim()) return
    startTransition(async () => {
      const result = await sendNewMessage(newSubject.trim(), newBody.trim())
      if ('error' in result) { toast.error(result.error); return }
      toast.success('Message sent')
      setSearchOpen(false)
      setSearchQuery('')
      setNewSubject('')
      setNewBody('')
      setSelectedId(result.id)
      setConversations((prev) => [{
        id: result.id,
        subject: newSubject.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        unread_count: 0,
        archived: false,
      }, ...prev])
    })
  }

  // ── Archive toggle ────────────────────────────────────────────────────────
  function handleToggleArchive() {
    if (!selectedId || !selectedConv) return
    const nextArchived = !selectedConv.archived
    // Optimistic update
    setConversations((prev) =>
      prev.map((c) => c.id === selectedId ? { ...c, archived: nextArchived } : c)
    )
    // Deselect when archiving from All/Unread view — conversation disappears from list
    if (nextArchived && inboxFilter !== 'archived') {
      setSelectedId(displayedConversations.find((c) => c.id !== selectedId)?.id ?? null)
    }
    startTransition(async () => {
      const result = await toggleArchiveConversation(selectedId, nextArchived)
      if (result?.error) {
        toast.error(result.error)
        // Rollback
        setConversations((prev) =>
          prev.map((c) => c.id === selectedId ? { ...c, archived: !nextArchived } : c)
        )
      } else {
        toast.success(nextArchived ? 'Conversation archived' : 'Conversation unarchived')
      }
    })
  }

  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-[#1A1A1A]">

      {/* ── Conversation list ──────────────────────────────────────────────── */}
      <div className={cn(
        'w-full md:w-72 shrink-0 border-r border-zinc-100 dark:border-zinc-800 flex flex-col',
        selectedId && !searchOpen ? 'hidden md:flex' : 'flex'
      )}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-black dark:text-white">Messages</h2>
            <p className="text-xs text-zinc-400">{displayedConversations.length} thread{displayedConversations.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => { setSearchOpen((v) => !v); setSearchQuery('') }}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="New message"
          >
            {searchOpen ? <X size={14} strokeWidth={1.5} /> : <Plus size={14} strokeWidth={1.5} />}
          </button>
        </div>

        {/* New message panel */}
        {searchOpen && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Message the team</p>
              <div className="relative">
                <Search size={13} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name…"
                  className="w-full h-8 pl-7 pr-3 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors placeholder:text-zinc-400"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {searchLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-zinc-300" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-zinc-400">No admins found</p>
                </div>
              ) : (
                searchResults.map((u) => (
                  <div key={u.id} className="px-3 py-2 border-b border-zinc-50 dark:border-zinc-800 last:border-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="shrink-0 w-7 h-7 rounded-full bg-black flex items-center justify-center text-white text-[10px] font-semibold">
                        {getInitials(u.full_name || u.email)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-black dark:text-white">{u.full_name || u.email}</p>
                        <p className="text-[10px] text-zinc-400 capitalize">{u.role}</p>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      placeholder="Subject…"
                      className="w-full h-7 px-2.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors mb-1.5 placeholder:text-zinc-400"
                    />
                    <textarea
                      value={newBody}
                      onChange={(e) => setNewBody(e.target.value)}
                      placeholder="Write a message…"
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors resize-none mb-1.5 placeholder:text-zinc-400"
                    />
                    <button
                      onClick={handleNewConversation}
                      disabled={isPending || !newSubject.trim() || !newBody.trim()}
                      className="w-full h-7 flex items-center justify-center gap-1.5 bg-black dark:bg-white text-white dark:text-black text-xs font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={11} strokeWidth={1.5} />}
                      Send
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Inbox search + filter tabs */}
        {!searchOpen && (
          <div className="px-3 pt-3 pb-2 space-y-2 border-b border-zinc-100 dark:border-zinc-800">
            {/* Search bar */}
            <div className="relative">
              <Search size={13} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full h-8 pl-8 pr-3 text-xs bg-gray-50 dark:bg-zinc-900 border-none rounded-xl text-zinc-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
              />
              {inboxSearch && (
                <button
                  type="button"
                  onClick={() => setInboxSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  <X size={11} strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
              {(['all', 'unread', 'archived'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setInboxFilter(tab)}
                  className={cn(
                    'flex-1 py-1 text-[11px] font-medium rounded-lg capitalize transition-all',
                    inboxFilter === tab
                      ? 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation list */}
        {!searchOpen && (
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-50 dark:divide-zinc-800">
            {displayedConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-4">
                <MessageSquare size={28} strokeWidth={1} className="text-zinc-200" />
                <p className="text-sm text-zinc-400">
                  {inboxFilter === 'archived' ? 'No archived conversations' :
                   inboxFilter === 'unread'   ? 'No unread messages' :
                   conversations.length === 0 ? 'No conversations yet' : 'No results'}
                </p>
                {conversations.length === 0 && (
                  <p className="text-xs text-zinc-300">Use the + button to message the team</p>
                )}
              </div>
            ) : (
              displayedConversations.map((conv) => {
                const isSelected = conv.id === selectedId
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={cn(
                      'w-full text-left px-4 py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/80',
                      isSelected && 'bg-zinc-50 dark:bg-zinc-800'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {adminAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={adminAvatarUrl} alt="" className="shrink-0 w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="shrink-0 w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-[9px] font-semibold">
                          {getInitials(adminName)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn('text-sm truncate', conv.unread_count > 0 ? 'font-semibold text-black dark:text-white' : 'font-medium text-zinc-700 dark:text-zinc-200')}>
                            {conv.subject || 'No subject'}
                          </p>
                          <span className="text-[10px] text-zinc-400 shrink-0">{timeAgo(conv.updated_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-xs text-zinc-400">with {adminName}</p>
                          {conv.archived && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                              <Archive size={9} strokeWidth={1.5} />
                              Archived
                            </span>
                          )}
                        </div>
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
          {/* Thread header */}
          <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
            <button
              className="md:hidden flex items-center justify-center w-7 h-7 text-zinc-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              onClick={() => setSelectedId(null)}
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-black dark:text-white truncate">{selectedConv.subject || 'No subject'}</p>
              <p className="text-xs text-zinc-400">with {adminName}</p>
            </div>

            {/* Archive / Unarchive button */}
            <button
              type="button"
              title={selectedConv.archived ? 'Unarchive conversation' : 'Archive conversation'}
              onClick={handleToggleArchive}
              disabled={isPending}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 shrink-0"
            >
              {selectedConv.archived
                ? <Inbox size={15} strokeWidth={1.5} />
                : <Archive size={15} strokeWidth={1.5} />
              }
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {loadingMsgs ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-zinc-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-zinc-400">No messages in this thread yet.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === currentUserId
                const name = isMe ? 'You' : (msg.sender?.full_name || adminName)
                const initials = getInitials(isMe ? 'You' : name)

                return (
                  <div key={msg.id} className={cn('flex gap-3', isMe && 'flex-row-reverse')}>
                    {msg.sender?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={msg.sender.avatar_url} alt="" className="shrink-0 w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className={cn(
                        'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold',
                        isMe ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300' : 'bg-black text-white'
                      )}>
                        {initials}
                      </div>
                    )}
                    <div className={cn('max-w-[70%]', isMe && 'items-end flex flex-col')}>
                      <div className={cn(
                        'rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
                        isMe
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tr-sm'
                          : 'bg-black text-white rounded-tl-sm'
                      )}>
                        {msg.body.split('\n').map((line, li) => {
                          const m = line.match(/^📎 \[(.+?)\]\((https?:\/\/.+?)\)$/)
                          if (m) return (
                            <a key={li} href={m[2]} target="_blank" rel="noopener noreferrer" className={cn('flex items-center gap-1 underline underline-offset-2 text-xs mt-1', isMe ? 'text-zinc-500' : 'text-zinc-300')}>
                              <Paperclip size={10} strokeWidth={1.5} className="shrink-0" />{m[1]}
                            </a>
                          )
                          return line ? <span key={li} className="block">{line}</span> : null
                        })}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 px-1">
                        {isMe ? 'You' : name} · {timeAgo(msg.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Reply form */}
          <form onSubmit={handleReply} className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
            {attachFile && (
              <div className="flex items-center gap-2 px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-600 dark:text-zinc-400">
                <Paperclip size={11} strokeWidth={1.5} className="shrink-0 text-zinc-400" />
                <span className="truncate flex-1">{attachFile.name}</span>
                <button type="button" onClick={() => { setAttachFile(null); if (attachRef.current) attachRef.current.value = '' }} className="shrink-0 text-zinc-400 hover:text-red-500">
                  <X size={11} strokeWidth={2} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input ref={attachRef} type="file" className="hidden" onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)} />
              <button
                type="button"
                onClick={() => attachRef.current?.click()}
                className="h-9 w-9 flex items-center justify-center text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
                title="Attach file"
              >
                <Paperclip size={14} strokeWidth={1.5} />
              </button>
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a reply…"
                className="flex-1 h-9 px-3 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors placeholder:text-zinc-400"
                disabled={isPending || uploading}
              />
              <button
                type="submit"
                disabled={isPending || uploading || (!reply.trim() && !attachFile)}
                className="h-9 w-9 flex items-center justify-center bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-zinc-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {(isPending || uploading) ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={1.5} />}
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
