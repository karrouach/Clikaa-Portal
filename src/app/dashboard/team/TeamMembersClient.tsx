'use client'

import { useState, useTransition } from 'react'
import { UserPlus, Trash2, Loader2, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inviteTeamMember, removeTeamMember } from './team-actions'
import type { Profile } from '@/types/database'
import { cn } from '@/lib/utils'

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  members: Profile[]
  currentUserId: string
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TeamMembersClient({ members, currentUserId }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleInvite() {
    setError(null)
    setInviteSuccess(false)
    startTransition(async () => {
      const result = await inviteTeamMember({ email: inviteEmail, fullName: inviteName })
      if (result.error) {
        setError(result.error)
      } else {
        setInviteSuccess(true)
        setInviteName('')
        setInviteEmail('')
        // Close dialog after short delay so user sees the success state
        setTimeout(() => {
          setInviteOpen(false)
          setInviteSuccess(false)
        }, 1500)
      }
    })
  }

  function handleRemove(userId: string) {
    if (!confirm('Remove this team member? This will revoke their portal access.')) return
    setError(null)
    setRemovingId(userId)
    startTransition(async () => {
      const result = await removeTeamMember(userId)
      setRemovingId(null)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div>
      {/* ── Page heading ─────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black tracking-tight">My Team</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {members.length} internal team member{members.length !== 1 ? 's' : ''} with portal access.
          </p>
        </div>

        <Button
          size="sm"
          rounded="sm"
          onClick={() => { setInviteOpen(true); setError(null); setInviteSuccess(false) }}
          className="gap-1.5 text-xs shrink-0"
        >
          <UserPlus size={13} strokeWidth={1.5} />
          Add Team Member
        </Button>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 text-red-700 text-sm">
          <AlertCircle size={15} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Members table ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-100 overflow-hidden">
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-zinc-900 mb-1">No team members yet</p>
            <p className="text-sm text-zinc-400">
              Invite your first team member to get started.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden md:table-cell">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                  Access
                </th>
                <th className="px-6 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isYou = member.id === currentUserId
                const isRemoving = removingId === member.id

                return (
                  <tr
                    key={member.id}
                    className={cn(
                      'border-b border-zinc-50 last:border-0 transition-colors',
                      isRemoving ? 'opacity-40' : 'hover:bg-zinc-50/50'
                    )}
                  >
                    {/* Member */}
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt=""
                            className="shrink-0 w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-semibold text-zinc-600 select-none">
                            {(member.full_name || member.email).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-black">
                            {member.full_name || '—'}
                            {isYou && (
                              <span className="ml-1.5 text-[10px] text-zinc-400 font-normal">
                                (you)
                              </span>
                            )}
                          </p>
                          {member.title ? (
                            <p className="text-xs text-zinc-500">{member.title}</p>
                          ) : (
                            <p className="text-xs text-zinc-400">{member.email}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Joined date */}
                    <td className="px-6 py-3.5 text-zinc-400 hidden md:table-cell">
                      {new Date(member.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Role badge */}
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-zinc-900 text-white">
                        Admin
                      </span>
                    </td>

                    {/* Remove */}
                    <td className="px-4 py-3.5 text-right">
                      {!isYou && (
                        <button
                          onClick={() => handleRemove(member.id)}
                          disabled={isPending}
                          className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:pointer-events-none"
                          title="Remove team member"
                        >
                          {isRemoving ? (
                            <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} strokeWidth={1.5} />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Invite dialog ─────────────────────────────────────────────────── */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          if (!isPending) {
            setInviteOpen(open)
            setError(null)
            setInviteSuccess(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Send a Supabase invite link to a new internal team member. They'll be granted
              Admin access to the portal.
            </DialogDescription>
          </DialogHeader>

          {inviteSuccess ? (
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-emerald-600">Invite sent successfully!</p>
              <p className="text-xs text-zinc-400 mt-1">
                They'll receive an email with a link to set their password.
              </p>
            </div>
          ) : (
            <div className="space-y-5 py-4">
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 text-red-700 text-sm">
                  <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label
                  htmlFor="invite-name"
                  className="text-xs uppercase tracking-wide text-zinc-600"
                >
                  Full name
                </Label>
                <Input
                  id="invite-name"
                  type="text"
                  placeholder="Jane Smith"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="invite-email"
                  className="text-xs uppercase tracking-wide text-zinc-600"
                >
                  Email address
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="jane@clikaa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isPending && handleInvite()}
                  disabled={isPending}
                />
              </div>

              <p className="text-xs text-zinc-400">
                The invitee will receive a portal access link via email.
              </p>
            </div>
          )}

          {!inviteSuccess && (
            <DialogFooter>
              <Button
                variant="outline"
                rounded="sm"
                onClick={() => setInviteOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                rounded="sm"
                onClick={handleInvite}
                disabled={isPending || !inviteEmail.trim() || !inviteName.trim()}
              >
                {isPending ? (
                  <>
                    <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  'Send Invite'
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
