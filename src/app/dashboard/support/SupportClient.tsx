'use client'

import { useState } from 'react'
import { Send, CheckCircle2, Clock, Mail, MessageCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface QuickContact {
  name: string
  role: string
  email: string
}

interface SupportClientProps {
  quickContacts: QuickContact[]
}

export function SupportClient({ quickContacts }: SupportClientProps) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return

    const mailto = `mailto:hello@clikaa.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
    window.open(mailto, '_blank')
    setSent(true)
    setTimeout(() => setSent(false), 4000)
    setSubject('')
    setMessage('')
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-zinc-100 rounded-2xl mb-4">
          <MessageCircle size={22} strokeWidth={1.5} className="text-zinc-700" />
        </div>
        <h1 className="text-2xl font-semibold text-black tracking-tight">How can we help?</h1>
        <p className="mt-2 text-sm text-zinc-500 max-w-sm mx-auto">
          We're here to support your project. Send us a message and we'll get back to you shortly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* ── Contact form ──────────────────────────────────────────────── */}
        <div className="md:col-span-2">
          <div className="bg-white border border-zinc-100 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-black mb-5">Send a message</h2>

            {sent ? (
              <div className="py-8 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 size={22} strokeWidth={1.5} className="text-emerald-600" />
                </div>
                <p className="text-sm font-medium text-emerald-700">Message sent!</p>
                <p className="text-xs text-zinc-400">Your email client opened with the message pre-filled.</p>
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
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-zinc-600">Message</Label>
                  <Textarea
                    placeholder="Describe what you need help with…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[140px] resize-none"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-zinc-400">
                    Sends to{' '}
                    <a href="mailto:hello@clikaa.com" className="text-zinc-600 hover:text-black underline underline-offset-2">
                      hello@clikaa.com
                    </a>
                  </p>
                  <Button
                    type="submit"
                    size="sm"
                    rounded="sm"
                    disabled={!subject.trim() || !message.trim()}
                    className="gap-1.5"
                  >
                    <Send size={13} strokeWidth={1.5} />
                    Send Message
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── Quick contacts + info ──────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Quick contacts */}
          <div className="bg-white border border-zinc-100 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-zinc-900 uppercase tracking-widest mb-4">Quick Contacts</h2>
            <div className="space-y-4">
              {quickContacts.length > 0 ? (
                quickContacts.map((contact) => (
                  <div key={contact.email} className="flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-semibold text-zinc-600">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-black truncate">{contact.name}</p>
                      <p className="text-xs text-zinc-500">{contact.role}</p>
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-xs text-zinc-400 hover:text-black transition-colors truncate block"
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
                    <p className="text-sm font-medium text-black">Clikaa Studio</p>
                    <p className="text-xs text-zinc-500">Lead Designer</p>
                    <a
                      href="mailto:hello@clikaa.com"
                      className="text-xs text-zinc-400 hover:text-black transition-colors"
                    >
                      hello@clikaa.com
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Response time info */}
          <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} strokeWidth={1.5} className="text-zinc-500" />
              <h2 className="text-xs font-semibold text-zinc-900 uppercase tracking-widest">Response Times</h2>
            </div>
            <div className="space-y-2.5 text-xs text-zinc-600">
              <div className="flex items-center justify-between">
                <span>General enquiries</span>
                <span className="font-medium text-black">24–48 hrs</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Urgent project issues</span>
                <span className="font-medium text-black">Same day</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Billing questions</span>
                <span className="font-medium text-black">1–2 days</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
