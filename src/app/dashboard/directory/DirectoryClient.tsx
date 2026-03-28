'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { UserPlus, Trash2, Loader2, AlertCircle, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inviteTeamMember, removeTeamMember } from '../team/team-actions'
import { inviteWorkspaceMember } from '../[workspaceId]/settings/workspace-settings-actions'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type InviteRole = 'admin' | 'designer'

export type TeamMember = {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  role: string
  title: string | null
  created_at: string
}

export type ClientEntry = {
  userId: string
  membershipId: string
  workspaceId: string
  workspaceName: string
  full_name: string
  email: string
  avatar_url: string | null
  title: string | null
  joinedDate: string
}

interface Props {
  teamMembers: TeamMember[]
  clients: ClientEntry[]
  currentUserId: string
  workspaces: { id: string; name: string }[]
}

// ─── Role badge styles ────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  admin:    'bg-zinc-900 text-white',
  designer: 'bg-violet-100 text-violet-700',
  client:   'bg-zinc-100 text-zinc-600',
}

// ─── Shared avatar helper ─────────────────────────────────────────────────────

function MemberAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return avatarUrl ? (
    <img src={avatarUrl} alt="" className="shrink-0 w-8 h-8 rounded-full object-cover" />
  ) : (
    <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 select-none">
      {getInitials(name)}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DirectoryClient({ teamMembers: initialTeam, clients, currentUserId, workspaces }: Props) {
  const [activeTab, setActiveTab] = useState<'admins' | 'designers' | 'clients'>('admins')
  const [team, setTeam]           = useState(initialTeam)
  const [error, setError]         = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // ── Invite team member dialog ──────────────────────────────────────────────
  const [inviteOpen, setInviteOpen]     = useState(false)
  const [inviteName, setInviteName]     = useState('')
  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviteRole, setInviteRole]     = useState<InviteRole>('designer')
  const [inviteSuccess, setInviteSuccess] = useState(false)

  function resetInvite() {
    setInviteName(''); setInviteEmail(''); setInviteRole('designer'); setInviteSuccess(false); setError(null)
  }

  function handleInvite() {
    setError(null)
    startTransition(async () => {
      const result = await inviteTeamMember({ email: inviteEmail, fullName: inviteName, role: inviteRole })
      if (result.error) { setError(result.error); return }
      setInviteSuccess(true)
      setTimeout(() => { setInviteOpen(false); resetInvite() }, 1500)
    })
  }

  // ── Invite client dialog ───────────────────────────────────────────────────
  const [clientInviteOpen, setClientInviteOpen]   = useState(false)
  const [clientName, setClientName]               = useState('')
  const [clientEmail, setClientEmail]             = useState('')
  const [clientWorkspace, setClientWorkspace]     = useState(workspaces[0]?.id ?? '')
  const [clientSuccess, setClientSuccess]         = useState(false)

  function resetClientInvite() {
    setClientName(''); setClientEmail(''); setClientWorkspace(workspaces[0]?.id ?? ''); setClientSuccess(false); setError(null)
  }

  function handleClientInvite() {
    if (!clientWorkspace) { setError('Please select a workspace.'); return }
    setError(null)
    startTransition(async () => {
      const result = await inviteWorkspaceMember({
        workspaceId: clientWorkspace,
        email: clientEmail,
        fullName: clientName,
        role: 'client',
      })
      if (result.error) { setError(result.error); return }
      setClientSuccess(true)
      setTimeout(() => { setClientInviteOpen(false); resetClientInvite() }, 1500)
    })
  }

  function handleRemove(userId: string) {
    if (!confirm('Remove this team member? This will revoke their portal access.')) return
    setError(null)
    setRemovingId(userId)
    startTransition(async () => {
      const result = await removeTeamMember(userId)
      setRemovingId(null)
      if (result.error) { setError(result.error); return }
      setTeam((prev) => prev.filter((m) => m.id !== userId))
    })
  }

  const admins    = team.filter((m) => m.role === 'admin')
  const designers = team.filter((m) => m.role === 'designer')

  const tabs = [
    { key: 'admins'    as const, label: 'Admins',    count: admins.length },
    { key: 'designers' as const, label: 'Internal Team', count: designers.length },
    { key: 'clients'   as const, label: 'Clients',   count: clients.length },
  ]

  return (
    <div className="animate-fade-in">
      {/* ── Page heading ───────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white tracking-tight">Directory</h1>
          <p className="mt-1 text-sm text-zinc-500">Internal team members and external clients.</p>
        </div>

        {(activeTab === 'admins' || activeTab === 'designers') && (
          <Button
            size="sm"
            rounded="sm"
            onClick={() => { setInviteOpen(true); resetInvite() }}
            className="gap-1.5 text-xs shrink-0"
          >
            <UserPlus size={13} strokeWidth={1.5} />
            Add Member
          </Button>
        )}

        {activeTab === 'clients' && (
          <Button
            size="sm"
            rounded="sm"
            onClick={() => { setClientInviteOpen(true); resetClientInvite() }}
            className="gap-1.5 text-xs shrink-0"
          >
            <UserPlus size={13} strokeWidth={1.5} />
            Add Client
          </Button>
        )}
      </div>

      {/* ── Error banner ───────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg">
          <AlertCircle size={15} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 mb-6 border-b border-zinc-100 dark:border-zinc-800">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'relative px-4 pb-3 pt-1 text-sm font-medium transition-colors duration-150',
              activeTab === key
                ? 'text-black dark:text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-black dark:after:bg-white'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            )}
          >
            {label}
            <span className={cn(
              'ml-1.5 text-[10px] tabular-nums px-1.5 py-0.5 rounded-full',
              activeTab === key ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Admins / Designers Tabs ────────────────────────────────────── */}
      {(activeTab === 'admins' || activeTab === 'designers') && (() => {
        const rows = activeTab === 'admins' ? admins : designers
        const emptyLabel = activeTab === 'admins' ? 'No admins yet' : 'No designers yet'
        return (
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm font-medium text-zinc-900 dark:text-white mb-1">{emptyLabel}</p>
                <p className="text-sm text-zinc-400">Invite a team member to get started.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Member</th>
                    <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Role</th>
                    <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden md:table-cell">Joined</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((member) => {
                    const isYou = member.id === currentUserId
                    const isRemoving = removingId === member.id
                    const displayName = member.full_name || member.email
                    return (
                      <tr
                        key={member.id}
                        className={cn(
                          'border-b border-zinc-50 dark:border-zinc-800 last:border-0 transition-colors',
                          isRemoving ? 'opacity-40' : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50'
                        )}
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <MemberAvatar name={displayName} avatarUrl={member.avatar_url} />
                            <div>
                              <Link
                                href={`/dashboard/team/${member.id}`}
                                className="font-medium text-black dark:text-white hover:underline underline-offset-2"
                              >
                                {displayName}
                                {isYou && <span className="ml-1.5 text-[10px] text-zinc-400 font-normal">(you)</span>}
                              </Link>
                              {member.title ? (
                                <p className="text-xs text-zinc-500">{member.title}</p>
                              ) : (
                                <p className="text-xs text-zinc-400">{member.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn('inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded capitalize', ROLE_BADGE[member.role] ?? 'bg-zinc-100 text-zinc-600')}>
                            {member.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-zinc-400 text-xs hidden md:table-cell">
                          {new Date(member.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {!isYou && (
                            <button
                              onClick={() => handleRemove(member.id)}
                              disabled={isPending}
                              className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors disabled:pointer-events-none"
                              title="Remove member"
                            >
                              {isRemoving
                                ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                                : <Trash2 size={14} strokeWidth={1.5} />
                              }
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
        )
      })()}

      {/* ── Clients Tab ────────────────────────────────────────────────── */}
      {activeTab === 'clients' && (
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-medium text-zinc-900 dark:text-white mb-1">No clients yet</p>
              <p className="text-sm text-zinc-400">Add your first client using the button above.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Client</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Role</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Joined</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden md:table-cell">Workspace</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const displayName = client.full_name || client.email
                  return (
                    <tr key={`${client.userId}-${client.workspaceId}`} className="border-b border-zinc-50 dark:border-zinc-800 last:border-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <MemberAvatar name={displayName} avatarUrl={client.avatar_url} />
                          <div>
                            <p className="font-medium text-black dark:text-white">{displayName}</p>
                            {client.title ? (
                              <p className="text-xs text-zinc-500">{client.title}</p>
                            ) : (
                              <p className="text-xs text-zinc-400">{client.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          client
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-zinc-400 text-xs whitespace-nowrap">
                        {client.joinedDate}
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <Link
                          href={`/dashboard/${client.workspaceId}/settings`}
                          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:underline underline-offset-2 transition-colors"
                        >
                          {client.workspaceName}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Invite team member dialog ───────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!isPending) { setInviteOpen(open); if (!open) resetInvite() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Invite an internal team member. They'll receive a portal access link via email.
            </DialogDescription>
          </DialogHeader>

          {inviteSuccess ? (
            <div className="py-6 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <Check size={18} strokeWidth={2} className="text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-emerald-600">Invite sent!</p>
              <p className="text-xs text-zinc-400">They'll receive an email to set their password.</p>
            </div>
          ) : (
            <div className="space-y-5 py-4">
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                  <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-zinc-600">Full name</Label>
                <Input type="text" placeholder="Jane Smith" value={inviteName} onChange={(e) => setInviteName(e.target.value)} disabled={isPending} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-zinc-600">Email address</Label>
                <Input type="email" placeholder="jane@clikaa.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isPending && handleInvite()} disabled={isPending} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-zinc-600">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as InviteRole)}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="designer">Designer — Internal team member</SelectItem>
                    <SelectItem value="admin">Admin — Full portal access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {!inviteSuccess && (
            <DialogFooter>
              <Button variant="outline" rounded="sm" onClick={() => setInviteOpen(false)} disabled={isPending}>Cancel</Button>
              <Button rounded="sm" onClick={handleInvite} disabled={isPending || !inviteEmail.trim() || !inviteName.trim()}>
                {isPending ? <><Loader2 size={13} strokeWidth={1.5} className="animate-spin" />Sending…</> : 'Send Invite'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add client dialog ───────────────────────────────────────────── */}
      <Dialog open={clientInviteOpen} onOpenChange={(open) => { if (!isPending) { setClientInviteOpen(open); if (!open) resetClientInvite() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
            <DialogDescription>
              Invite a client to a workspace. They'll receive a portal access link via email.
            </DialogDescription>
          </DialogHeader>

          {clientSuccess ? (
            <div className="py-6 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <Check size={18} strokeWidth={2} className="text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-emerald-600">Client invited!</p>
              <p className="text-xs text-zinc-400">They'll receive an email to access their workspace.</p>
            </div>
          ) : (
            <div className="space-y-5 py-4">
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                  <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-zinc-600">Full name</Label>
                <Input type="text" placeholder="Alex Johnson" value={clientName} onChange={(e) => setClientName(e.target.value)} disabled={isPending} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-zinc-600">Email address</Label>
                <Input type="email" placeholder="alex@company.com" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} disabled={isPending} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-zinc-600">Workspace</Label>
                <Select value={clientWorkspace} onValueChange={setClientWorkspace}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Select a workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {!clientSuccess && (
            <DialogFooter>
              <Button variant="outline" rounded="sm" onClick={() => setClientInviteOpen(false)} disabled={isPending}>Cancel</Button>
              <Button rounded="sm" onClick={handleClientInvite} disabled={isPending || !clientEmail.trim() || !clientWorkspace}>
                {isPending ? <><Loader2 size={13} strokeWidth={1.5} className="animate-spin" />Sending…</> : 'Send Invite'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
