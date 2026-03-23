'use client'

import { useState, useTransition } from 'react'
import { UserPlus, Trash2, Loader2, AlertCircle, Check, Pencil } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import {
  updateWorkspaceName,
  removeWorkspaceMember,
  inviteWorkspaceMember,
} from './workspace-settings-actions'

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = 'admin' | 'client' | 'designer'

interface MemberProfile {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  title: string | null
}

interface Member {
  membershipId: string
  userId: string
  role: Role
  profile: MemberProfile | null
}

interface Workspace {
  id: string
  name: string
}

interface Props {
  workspace: Workspace
  members: Member[]
  currentUserId: string
  isAdmin: boolean
}

// ─── Role styles ──────────────────────────────────────────────────────────────
const ROLE_BADGE: Record<Role, string> = {
  admin:    'bg-zinc-900 text-white',
  designer: 'bg-violet-100 text-violet-700',
  client:   'bg-zinc-100 text-zinc-600',
}

const ROLE_LABEL: Record<Role, string> = {
  admin:    'Admin',
  designer: 'Designer',
  client:   'Client',
}

// ─── Component ────────────────────────────────────────────────────────────────
export function WorkspaceSettingsClient({ workspace, members, currentUserId, isAdmin }: Props) {
  // ── Workspace name editing ─────────────────────────────────────────────────
  const [wsName, setWsName]           = useState(workspace.name)
  const [editingName, setEditingName] = useState(false)
  const [nameSaved, setNameSaved]     = useState(false)
  const [nameError, setNameError]     = useState<string | null>(null)
  const [isNamePending, startNameTransition] = useTransition()

  function handleSaveName() {
    setNameError(null)
    setNameSaved(false)
    startNameTransition(async () => {
      const result = await updateWorkspaceName(workspace.id, wsName)
      if (result.error) {
        setNameError(result.error)
      } else {
        setNameSaved(true)
        setEditingName(false)
        setTimeout(() => setNameSaved(false), 2000)
      }
    })
  }

  // ── Member removal ─────────────────────────────────────────────────────────
  const [removingId, setRemovingId]   = useState<string | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [isMemberPending, startMemberTransition] = useTransition()

  function handleRemoveMember(membershipId: string, userId: string) {
    if (!confirm('Remove this member from the workspace? They will lose access to this board.')) return
    setMemberError(null)
    setRemovingId(membershipId)
    startMemberTransition(async () => {
      const result = await removeWorkspaceMember(workspace.id, membershipId, userId)
      setRemovingId(null)
      if (result.error) setMemberError(result.error)
    })
  }

  // ── Invite dialog ──────────────────────────────────────────────────────────
  const [inviteOpen, setInviteOpen]         = useState(false)
  const [inviteEmail, setInviteEmail]       = useState('')
  const [inviteName, setInviteName]         = useState('')
  const [inviteRole, setInviteRole]         = useState<Role>('client')
  const [inviteError, setInviteError]       = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess]   = useState(false)
  const [isInvitePending, startInviteTransition] = useTransition()

  function handleCloseInvite() {
    if (isInvitePending) return
    setInviteOpen(false)
    setInviteEmail('')
    setInviteName('')
    setInviteRole('client')
    setInviteError(null)
    setInviteSuccess(false)
  }

  function handleInvite() {
    setInviteError(null)
    startInviteTransition(async () => {
      const result = await inviteWorkspaceMember({
        workspaceId: workspace.id,
        email: inviteEmail,
        fullName: inviteName,
        role: inviteRole,
      })
      if (result.error) {
        setInviteError(result.error)
      } else {
        setInviteSuccess(true)
        setTimeout(() => handleCloseInvite(), 1500)
      }
    })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-8 max-w-3xl mx-auto space-y-8">

        {/* ── Heading ──────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-semibold text-black tracking-tight">Workspace Settings</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage this workspace's name and member access.
          </p>
        </div>

        {/* ── General — edit workspace name ─────────────────────────────────── */}
        {isAdmin && (
          <div className="bg-white border border-zinc-100">
            <div className="px-6 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-black">General</h2>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-zinc-600">
                  Workspace name
                </Label>

                {editingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={wsName}
                      onChange={(e) => setWsName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName()
                        if (e.key === 'Escape') { setEditingName(false); setWsName(workspace.name) }
                      }}
                      disabled={isNamePending}
                      className="max-w-xs"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      rounded="sm"
                      onClick={handleSaveName}
                      disabled={isNamePending || !wsName.trim()}
                    >
                      {isNamePending
                        ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                        : 'Save'
                      }
                    </Button>
                    <Button
                      size="sm"
                      rounded="sm"
                      variant="outline"
                      onClick={() => { setEditingName(false); setWsName(workspace.name) }}
                      disabled={isNamePending}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-black">{wsName}</span>
                    {nameSaved && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <Check size={12} strokeWidth={2} /> Saved
                      </span>
                    )}
                    <button
                      onClick={() => setEditingName(true)}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-black transition-colors"
                    >
                      <Pencil size={11} strokeWidth={1.5} />
                      Edit
                    </button>
                  </div>
                )}

                {nameError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle size={12} strokeWidth={1.5} />
                    {nameError}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Manage Access ─────────────────────────────────────────────────── */}
        <div className="bg-white border border-zinc-100">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
            <div>
              <h2 className="text-sm font-semibold text-black">Manage Access</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {members.length} member{members.length !== 1 ? 's' : ''} in this workspace
              </p>
            </div>

            {isAdmin && (
              <Button
                size="sm"
                rounded="sm"
                onClick={() => setInviteOpen(true)}
                className="gap-1.5 text-xs"
              >
                <UserPlus size={13} strokeWidth={1.5} />
                Invite Member
              </Button>
            )}
          </div>

          {/* Error banner */}
          {memberError && (
            <div className="mx-6 mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-100 text-red-700 text-sm">
              <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
              {memberError}
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest w-28">
                  Role
                </th>
                {isAdmin && <th className="px-4 py-3 w-10" />}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isYou      = member.userId === currentUserId
                const isRemoving = removingId === member.membershipId
                const p          = member.profile
                const displayName = p?.full_name || p?.email || 'Unknown'
                const initials   = displayName.slice(0, 2).toUpperCase()

                return (
                  <tr
                    key={member.membershipId}
                    className={cn(
                      'border-b border-zinc-50 last:border-0 transition-colors',
                      isRemoving ? 'opacity-40' : 'hover:bg-zinc-50/40'
                    )}
                  >
                    {/* Member info */}
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        {p?.avatar_url ? (
                          <img
                            src={p.avatar_url}
                            alt=""
                            className="shrink-0 w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-semibold text-zinc-600 select-none">
                            {initials}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-black text-sm">
                            {displayName}
                            {isYou && (
                              <span className="ml-1.5 text-[10px] text-zinc-400 font-normal">(you)</span>
                            )}
                          </p>
                          {p?.title ? (
                            <p className="text-xs text-zinc-400">{p.title}</p>
                          ) : (
                            <p className="text-xs text-zinc-400">{p?.email}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role badge + select */}
                    <td className="px-6 py-3.5">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 text-[10px] font-medium',
                          ROLE_BADGE[member.role]
                        )}
                      >
                        {ROLE_LABEL[member.role]}
                      </span>
                    </td>

                    {/* Remove button (admin only, not self) */}
                    {isAdmin && (
                      <td className="px-4 py-3.5 text-right">
                        {!isYou && (
                          <button
                            onClick={() => handleRemoveMember(member.membershipId, member.userId)}
                            disabled={isMemberPending}
                            title="Remove from workspace"
                            className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:pointer-events-none"
                          >
                            {isRemoving ? (
                              <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} strokeWidth={1.5} />
                            )}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Role legend ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 border border-zinc-100 bg-white">
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium mb-2 bg-zinc-900 text-white">
              Admin
            </span>
            <p className="text-xs text-zinc-500">Full access — can manage tasks, files, and settings.</p>
          </div>
          <div className="p-4 border border-zinc-100 bg-white">
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium mb-2 bg-zinc-100 text-zinc-600">
              Client
            </span>
            <p className="text-xs text-zinc-500">Client access — can view and update their board.</p>
          </div>
        </div>

      </div>

      {/* ── Invite Member dialog ──────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={handleCloseInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Add someone to this workspace. Existing portal users are added instantly — new users receive an email invite.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Error / success banners */}
            {inviteError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg text-green-700 text-sm">
                <Check size={14} strokeWidth={2} className="shrink-0" />
                Member added successfully!
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600">
                Email address <span className="text-red-400 normal-case">*</span>
              </Label>
              <Input
                type="email"
                placeholder="client@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isInvitePending || inviteSuccess}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600">
                Full name <span className="text-zinc-400 text-[10px] normal-case">(optional — for new users)</span>
              </Label>
              <Input
                type="text"
                placeholder="Jane Smith"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                disabled={isInvitePending || inviteSuccess}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600">
                Role
              </Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)} disabled={isInvitePending || inviteSuccess}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client — Board access</SelectItem>
                  <SelectItem value="designer">Designer — Team member</SelectItem>
                  <SelectItem value="admin">Admin — Full access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" rounded="sm" onClick={handleCloseInvite} disabled={isInvitePending}>
              Cancel
            </Button>
            <Button
              rounded="sm"
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || isInvitePending || inviteSuccess}
            >
              {isInvitePending && <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />}
              {isInvitePending ? 'Adding…' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
