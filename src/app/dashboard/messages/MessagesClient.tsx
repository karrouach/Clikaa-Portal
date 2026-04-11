'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageSquare, Send, Loader2, User, Search, X, Plus, Paperclip, Archive, Inbox } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/client'
import {
  replyToConversation,
  markConversationRead,
  searchUsersForMessaging,
  adminStartConversation,
  toggleArchiveConversation,
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

function toSnippet(body: string): string {
  return body
    .replace(/📎 \[.+?\]\(https?:\/\/.+?\)/g, '📎 Attachment')
    .replace(/\n+/g, ' ')
    .trim()
}

export function MessagesClient({ initialConversations, currentUserId }: Props) {
  const searchParams = useSearchParams()
  const [conversations, setConversations] = useState<ConvItem[]>(initialConversations)
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const fromUrl = searchParams.get('conversationId')
    if (fromUrl && initialConversations.some((c) => c.id === fromUrl)) return fromUrl
    return initialConversations[0]?.id ?? null
  })
  const [messages, setMessages] = useState<MsgItem[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [reply, setReply] = useState('')
  const [isPending, startTransition] = useTransition()
  const threadEndRef = useRef<HTMLDivElement>(null)

  // Search / new conversation
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [searchFilter, setSearchFilter] = useState<'all' | 'client' | 'designer'>('all')
  const [searchLoading, setSearchLoading] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newTarget, setNewTarget] = useState<SearchUser | null>(null)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Inbox search & filter
  const [inboxSearch, setInboxSearch]   = useState('')
  const [inboxFilter, setInboxFilter]   = useState<'all' | 'unread' | 'archived'>('all')

  // Sidebar snippets — latest message body per conversation
  const [snippets, setSnippets] = useState<Record<string, string>>({})

  // File upload
  const [attachFile, setAttachFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const attachRef = useRef<HTMLInputElement>(null)

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null

  // Inbox search + filter
  const displayedConversations = conversations.filter((c) => {
    const name    = (c.client?.full_name || c.client?.email || '').toLowerCase()
    const subject = (c.subject || '').toLowerCase()
    const q       = inboxSearch.toLowerCase()
    const matchesSearch = !q || name.includes(q) || subject.includes(q)
    const matchesFilter =
      inboxFilter === 'unread'   ? c.unread_count > 0 && !c.archived :
      inboxFilter === 'archived' ? c.archived :
      !c.archived  // 'all' hides archived threads (they live in 'archived' tab)
    return matchesSearch && matchesFilter
  })

  // Filter search results by role pill (client-side, RBAC already handled server-side)
  const filteredResults = searchResults.filter((u) =>
    searchFilter === 'all' ? true : u.role === searchFilter
  )

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
        const msgs = (data ?? []) as MsgItem[]
        setMessages(msgs)
        setLoadingMsgs(false)
        markConversationRead(selectedId)
        setConversations((prev) =>
          prev.map((c) => c.id === selectedId ? { ...c, unread_count: 0 } : c)
        )
        if (msgs.length > 0) {
          setSnippets((prev) => ({ ...prev, [selectedId]: msgs[msgs.length - 1].body }))
        }
      })
  }, [selectedId])

  // ── Scroll to bottom ─────────────────────────────────────────────────────
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── selectedId ref — lets the realtime callback read the latest value
  //    without needing the channel to be recreated on every selection change
  const selectedIdRef = useRef(selectedId)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  // ── Single consolidated realtime channel ─────────────────────────────────
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const channel = supabase
      .channel('realtime:admin-portal')
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
          setSnippets((prev) => ({ ...prev, [raw.conversation_id]: raw.body }))
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
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        async (payload) => {
          console.log('Realtime Conversation Received!', payload)
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
            archived: false,
            client: clientData ?? null,
            unread_count: 1,
          }
          setConversations((prev) => [newConv, ...prev])
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

  // ── Fetch latest message snippet per conversation on mount ───────────────
  useEffect(() => {
    const ids = initialConversations.map((c) => c.id)
    if (ids.length === 0) return
    const supabase = createClient()
    supabase
      .from('messages')
      .select('conversation_id, body, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })
      .limit(ids.length * 3)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        for (const msg of (data ?? [])) {
          if (!map[msg.conversation_id]) map[msg.conversation_id] = msg.body
        }
        setSnippets(map)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── File upload helper ───────────────────────────────────────────────────
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

  // ── Send reply ───────────────────────────────────────────────────────────
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
      setSnippets((prev) => ({ ...prev, [selectedId]: body }))
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

  // ── Archive / unarchive ──────────────────────────────────────────────────
  async function handleToggleArchive(e: React.MouseEvent, convId: string, currentlyArchived: boolean) {
    e.preventDefault()
    e.stopPropagation()
    const archive = !currentlyArchived
    // Optimistic update
    setConversations((prev) =>
      prev.map((c) => c.id === convId ? { ...c, archived: archive } : c)
    )
    // If we just archived the active conversation, deselect it
    if (archive && selectedId === convId) setSelectedId(null)
    const result = await toggleArchiveConversation(convId, archive)
    if (result.error) {
      toast.error(result.error)
      // Revert on failure
      setConversations((prev) =>
        prev.map((c) => c.id === convId ? { ...c, archived: currentlyArchived } : c)
      )
    } else {
      toast.success(archive ? 'Conversation archived' : 'Moved back to inbox')
    }
  }

  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-[#1A1A1A]">

      {/* ── Conversation list ──────────────────────────────────────────────── */}
      <div className={cn(
        'w-full md:w-80 shrink-0 border-r border-zinc-100 dark:border-zinc-800 flex flex-col',
        selectedId && !searchOpen ? 'hidden md:flex' : 'flex'
      )}>
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-black dark:text-white">Messages</h2>
            <p className="text-xs text-zinc-400">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => { setSearchOpen((v) => !v); setNewTarget(null); setSearchQuery('') }}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="New message"
          >
            {searchOpen ? <X size={14} strokeWidth={1.5} /> : <Plus size={14} strokeWidth={1.5} />}
          </button>
        </div>

        {/* Search / New message panel */}
        {searchOpen ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 space-y-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">New message to…</p>
              <div className="relative">
                <Search size={13} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clients or designers…"
                  className="w-full h-8 pl-7 pr-3 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors placeholder:text-zinc-400"
                />
              </div>
              {/* Role filter pills */}
              <div className="flex items-center gap-1.5">
                {(['all', 'client', 'designer'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setSearchFilter(f)}
                    className={cn(
                      'h-6 px-2.5 text-[10px] font-medium rounded-full border transition-colors',
                      searchFilter === f
                        ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                        : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
                    )}
                  >
                    {f === 'all' ? 'All' : f === 'client' ? 'Clients' : 'Designers'}
                  </button>
                ))}
              </div>
            </div>

            {/* User results */}
            <div className="flex-1 overflow-y-auto">
              {searchLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-zinc-300" />
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-zinc-400">No users found</p>
                </div>
              ) : (
                filteredResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setNewTarget(u)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors',
                      newTarget?.id === u.id && 'bg-zinc-50 dark:bg-zinc-800'
                    )}
                  >
                    <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-900 dark:bg-zinc-700 flex items-center justify-center text-white text-[10px] font-semibold">
                      {getInitials(u.full_name || u.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-black dark:text-white truncate">{u.full_name || u.email}</p>
                      <p className="text-[10px] text-zinc-400 capitalize">{u.role}</p>
                    </div>
                    {newTarget?.id === u.id && (
                      <span className="ml-auto w-1.5 h-1.5 bg-black dark:bg-white rounded-full shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Compose area */}
            {newTarget && (
              <div className="border-t border-zinc-100 dark:border-zinc-800 p-3 space-y-2">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  To: <span className="font-medium text-black dark:text-white">{newTarget.full_name || newTarget.email}</span>
                </p>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Subject…"
                  className="w-full h-8 px-2.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors placeholder:text-zinc-400"
                />
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Write a message…"
                  rows={3}
                  className="w-full px-2.5 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors resize-none placeholder:text-zinc-400"
                />
                <button
                  onClick={handleNewConversation}
                  disabled={isPending || !newSubject.trim() || !newBody.trim()}
                  className="w-full h-8 flex items-center justify-center gap-1.5 bg-black dark:bg-white text-white dark:text-black text-xs font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={12} strokeWidth={1.5} />}
                  Send
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ── Sticky search + filter header ──────────────────────────── */}
            <div className="shrink-0 px-3 pt-2 pb-3 space-y-2.5 border-b border-zinc-100 dark:border-zinc-800">
              {/* Search bar */}
              <div className="relative">
                <Search size={13} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={inboxSearch}
                  onChange={(e) => setInboxSearch(e.target.value)}
                  placeholder="Search messages..."
                  className="w-full h-8 pl-8 pr-3 text-xs bg-gray-100 dark:bg-zinc-900 border border-transparent dark:border-zinc-700 rounded-xl text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-500 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                />
              </div>

              {/* Filter segmented control */}
              <div className="flex bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-0.5 gap-0.5">
                {(['all', 'unread', 'archived'] as const).map((f) => {
                  const labels = { all: 'All', unread: 'Unread', archived: 'Archived' }
                  const isActive = inboxFilter === f
                  return (
                    <button
                      key={f}
                      onClick={() => setInboxFilter(f)}
                      className={cn(
                        'flex-1 h-6 text-[11px] font-medium rounded-lg transition-all',
                        isActive
                          ? 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
                      )}
                    >
                      {labels[f]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Scrollable conversation list ───────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-4">
                  <MessageSquare size={28} strokeWidth={1} className="text-zinc-200" />
                  <p className="text-sm text-zinc-400">No messages yet</p>
                  <p className="text-xs text-zinc-300">Client messages will appear here</p>
                </div>
              ) : displayedConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-1.5 text-center px-4">
                  <p className="text-sm text-zinc-400">No results</p>
                  <p className="text-xs text-zinc-300">Try a different search or filter</p>
                </div>
              ) : (
                displayedConversations.map((conv) => {
                  const clientName = conv.client?.full_name || conv.client?.email || 'Unknown'
                  const initials   = getInitials(clientName)
                  const isSelected = conv.id === selectedId
                  const hasUnread  = conv.unread_count > 0
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedId(conv.id)}
                      className={cn(
                        'group w-full text-left px-4 py-3 border-b border-gray-100 dark:border-zinc-800 last:border-0 transition-colors',
                        isSelected
                          ? 'bg-gray-100 dark:bg-zinc-800'
                          : 'hover:bg-gray-50 dark:hover:bg-zinc-900/50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        {conv.client?.avatar_url ? (
                          <img src={conv.client.avatar_url} alt="" className="shrink-0 w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-700 flex items-center justify-center text-white text-[10px] font-semibold">
                            {initials}
                          </div>
                        )}

                        {/* Text rows */}
                        <div className="min-w-0 flex-1">
                          {/* Top row: name + timestamp */}
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn(
                              'text-sm truncate',
                              hasUnread ? 'font-bold text-black dark:text-white' : 'font-medium text-zinc-700 dark:text-zinc-300'
                            )}>
                              {clientName}
                            </p>
                            <span className="text-[10px] text-zinc-400 shrink-0 tabular-nums">{timeAgo(conv.updated_at)}</span>
                          </div>
                          {/* Bottom row: latest message snippet */}
                          <p className="text-xs text-gray-500 dark:text-zinc-400 truncate mt-0.5">
                            {snippets[conv.id] ? toSnippet(snippets[conv.id]) : (conv.subject || 'No subject')}
                          </p>
                        </div>

                        {/* Unread dot */}
                        {hasUnread && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-black dark:bg-white" />
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Thread view ───────────────────────────────────────────────────── */}
      {selectedConv ? (
        <div className={cn(
          'flex-1 flex flex-col min-w-0',
          !selectedId ? 'hidden md:flex' : 'flex'
        )}>
          <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
            <button
              className="md:hidden w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              onClick={() => setSelectedId(null)}
            >
              ←
            </button>
            {selectedConv.client?.avatar_url ? (
              <img src={selectedConv.client.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 hidden md:block" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-zinc-900 dark:bg-zinc-700 shrink-0 hidden md:flex items-center justify-center text-white text-[10px] font-semibold">
                {getInitials(selectedConv.client?.full_name || selectedConv.client?.email || '?')}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-black dark:text-white truncate">{selectedConv.client?.full_name || selectedConv.client?.email || 'Unknown'}</p>
              <p className="text-xs text-zinc-400 truncate">{selectedConv.subject || 'No subject'}</p>
            </div>
            <button
              onClick={(e) => handleToggleArchive(e, selectedConv.id, selectedConv.archived)}
              title={selectedConv.archived ? 'Move to inbox' : 'Archive'}
              className="shrink-0 p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-black dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
            >
              {selectedConv.archived
                ? <Inbox size={15} strokeWidth={1.5} />
                : <Archive size={15} strokeWidth={1.5} />
              }
            </button>
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
              messages.map((msg, idx) => {
                const isCurrentUser = msg.sender_id === currentUserId
                const senderName = msg.sender?.full_name || msg.sender?.email || (isCurrentUser ? 'You' : 'Client')
                const initials = getInitials(senderName)
                const nextMsg = messages[idx + 1]
                const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id
                return (
                  <div key={msg.id} className={cn('flex gap-2', isCurrentUser ? 'flex-row-reverse' : 'flex-row')}>
                    {/* Avatar — only shown on last bubble in a cluster */}
                    <div className="w-7 self-end shrink-0">
                      {isLastInGroup && (
                        msg.sender?.avatar_url ? (
                          <img src={msg.sender.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold',
                            isCurrentUser ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          )}>
                            {initials || <User size={12} />}
                          </div>
                        )
                      )}
                    </div>
                    <div className={cn('max-w-[70%]', isCurrentUser && 'items-end flex flex-col')}>
                      <div className={cn(
                        'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                        isCurrentUser
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-black rounded-br-sm'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-bl-sm'
                      )}>
                        {msg.body.split('\n').map((line, li) => {
                          const m = line.match(/^📎 \[(.+?)\]\((https?:\/\/.+?)\)$/)
                          if (m) return (
                            <a key={li} href={m[2]} target="_blank" rel="noopener noreferrer" className={cn('flex items-center gap-1 underline underline-offset-2 text-xs mt-1', isCurrentUser ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500')}>
                              <Paperclip size={10} strokeWidth={1.5} className="shrink-0" />{m[1]}
                            </a>
                          )
                          return line ? <span key={li} className="block">{line}</span> : null
                        })}
                      </div>
                      {isLastInGroup && (
                        <p className="text-[10px] text-zinc-400 mt-1 px-1">
                          {isCurrentUser ? 'You' : senderName} · {timeAgo(msg.created_at)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={threadEndRef} />
          </div>

          <form onSubmit={handleReply} className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
            {attachFile && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-full text-xs text-zinc-600 dark:text-zinc-400">
                <Paperclip size={11} strokeWidth={1.5} className="shrink-0 text-zinc-400" />
                <span className="truncate flex-1">{attachFile.name}</span>
                <button type="button" onClick={() => { setAttachFile(null); if (attachRef.current) attachRef.current.value = '' }} className="shrink-0 text-zinc-400 hover:text-red-500">
                  <X size={11} strokeWidth={2} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 px-3 py-1.5">
              <input ref={attachRef} type="file" className="hidden" onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)} />
              <button
                type="button"
                onClick={() => attachRef.current?.click()}
                className="flex items-center justify-center text-zinc-400 hover:text-black dark:hover:text-white transition-colors shrink-0"
                title="Attach file"
              >
                <Paperclip size={14} strokeWidth={1.5} />
              </button>
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    e.currentTarget.form?.requestSubmit()
                  }
                }}
                placeholder="Reply…"
                className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-white focus:outline-none placeholder:text-zinc-400"
                disabled={isPending || uploading}
              />
              <button
                type="submit"
                disabled={isPending || uploading || (!reply.trim() && !attachFile)}
                className="flex items-center justify-center w-7 h-7 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full hover:bg-zinc-700 dark:hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {(isPending || uploading) ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} strokeWidth={1.5} />}
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
