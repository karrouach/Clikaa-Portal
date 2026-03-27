'use client'

import { useState, useTransition } from 'react'
import { Send, CheckCircle2, Clock, Mail, MessageCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { sendNewMessage } from '@/app/dashboard/messages/message-actions'

interface QuickContact {
  name: string
  role: string
  email: string
}

interface SupportClientProps {
  quickContacts: QuickContact[]
  workspaceId?: string | null
}


export function SupportClient({ quickContacts, workspaceId }: SupportClientProps) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    setError(null)

    startTransition(async () => {
      try {
        await sendNewMessage(subject.trim(), message.trim(), workspaceId)
        setSent(true)
        setSubject('')
        setMessage('')
        setTimeout(() => setSent(false), 6000)
      } catch {
        setError('Failed to send message. Please try again.')
      }
    })
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl mb-4">
          <MessageCircle size={22} strokeWidth={1.5} className="text-zinc-700 dark:text-zinc-300" />
        </div>
        <h1 className="text-2xl font-semibold text-black dark:text-white tracking-tight">How can we help?</h1>
        <p className="mt-2 text-sm text-zinc-500 max-w-sm mx-auto">
          Send us a message and we'll get back to you. You'll receive a notification when we reply.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* ── Contact form ──────────────────────────────────────────────── */}
        <div className="md:col-span-2">
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-black dark:text-white mb-5">Send a message</h2>

            {sent ? (
              <div className="py-8 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 size={22} strokeWidth={1.5} className="text-emerald-600" />
                </div>
                <p className="text-sm font-medium text-emerald-700">Message sent!</p>
                <p className="text-xs text-zinc-400">
                  We'll reply soon. You'll get a notification when we respond.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSend} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-zinc-600">Subject</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Question about my project timeline"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-zinc-600">Message</Label>
                  <Textarea
                    placeholder="Describe what you need help with…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[140px] resize-none"
                    disabled={isPending}
                  />
                </div>
                {error && (
                  <p className="text-xs text-red-600">{error}</p>
                )}
                <div className="flex items-center justify-end pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    rounded="sm"
                    disabled={!subject.trim() || !message.trim() || isPending}
                    className="gap-1.5"
                  >
                    <Send size={13} strokeWidth={1.5} />
                    {isPending ? 'Sending…' : 'Send Message'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── Quick contacts + info ──────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Quick contacts */}
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-widest mb-4">Quick Contacts</h2>
            <div className="space-y-4">
              {quickContacts.length > 0 ? (
                quickContacts.map((contact) => (
                  <div key={contact.email} className="flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-black dark:text-white truncate whitespace-nowrap">{contact.name}</p>
                      <p className="text-xs text-zinc-500 whitespace-nowrap">{contact.role}</p>
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-xs text-zinc-400 hover:text-black dark:hover:text-white transition-colors truncate whitespace-nowrap block"
                      >
                        {contact.email}
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                    <Mail size={14} strokeWidth={1.5} className="text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black dark:text-white">Clikaa Studio</p>
                    <p className="text-xs text-zinc-500">Lead Designer</p>
                    <a href="mailto:hello@clikaa.com" className="text-xs text-zinc-400 hover:text-black transition-colors">
                      hello@clikaa.com
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Response time info */}
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} strokeWidth={1.5} className="text-zinc-500" />
              <h2 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-widest">Response Times</h2>
            </div>
            <div className="space-y-2.5 text-xs text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center justify-between">
                <span>General enquiries</span>
                <span className="font-medium text-black dark:text-white">24–48 hrs</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Urgent project issues</span>
                <span className="font-medium text-black dark:text-white">Same day</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Billing questions</span>
                <span className="font-medium text-black dark:text-white">1–2 days</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
