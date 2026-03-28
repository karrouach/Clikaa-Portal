'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Trash2, Loader2, AlertCircle, Check, Pencil, ImagePlus } from 'lucide-react'
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
  uploadWorkspaceLogoFile,
  removeWorkspaceMember,
  inviteWorkspaceMember,
  deleteWorkspace,
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
  logo_url: string | null
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
  client:   'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300',
}

const ROLE_LABEL: Record<Role, string> = {
  admin:    'Admin',
  designer: 'Designer',
  client:   'Client',
}

// ─── Component ────────────────────────────────────────────────────────────────
export function WorkspaceSettingsClient({ workspace, members, currentUserId, isAdmin }: Props) {
  const router = useRouter()
  // ── Workspace logo upload ──────────────────────────────────────────────────
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [logoPreview, setLogoPreview]   = useState<string | null>(workspace.logo_url)
  const [logoError, setLogoError]       = useState<string | null>(null)
  const [isLogoPending, startLogoTransition] = useTransition()

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLogoError(null)
    startLogoTransition(async () => {
      const fd = new FormData()
      fd.set('file', file)
      const result = await uploadWorkspaceLogoFile(workspace.id, fd)
      if (result.error) { setLogoError(result.error); return }
      if (result.url) setLogoPreview(result.url)
      if (logoInputRef.current) logoInputRef.current.value = ''
    })
  }

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

  // ── Workspace deletion ─────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen]       = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError, setDeleteError]     = useState<string | null>(null)
  const [isDeletePending, startDeleteTransition] = useTransition()

  function handleDeleteWorkspace() {
    if (deleteConfirm !== workspace.name) return
    setDeleteError(null)
    startDeleteTransition(async () => {
      const result = await deleteWorkspace(workspace.id)
      if (result.error) {
        setDeleteError(result.error)
      } else {
        router.push('/dashboard')
      }
    })
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
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-8">

        {/* ── Heading ──────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white tracking-tight">Workspace Settings</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage this workspace's name and member access.
          </p>
        </div>

        {/* ── General — edit workspace name ─────────────────────────────────── */}
        {isAdmin && (
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-black dark:text-white">General</h2>
            </div>

            <div className="px-6 py-5 space-y-6">

              {/* ── Logo ─────────────────────────────────────────────────── */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-zinc-600">
                  Workspace Logo
                </Label>
                <div className="flex items-center gap-4">
                  {/* Preview — forced square via CSS (object-cover) */}
                  <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                    {logoPreview ? (
                      <img src={logoPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-semibold text-zinc-500 dark:text-zinc-400 select-none">
                        {workspace.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isLogoPending}
                      className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 dark:text-zinc-300"
                    >
                      {isLogoPending ? (
                        <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
                      ) : (
                        <ImagePlus size={11} strokeWidth={1.5} />
                      )}
                      {isLogoPending ? 'Uploading…' : (logoPreview ? 'Change Logo' : 'Upload Logo')}
                    </button>
                    <p className="mt-1 text-[10px] text-zinc-400">
                      Square images recommended. Auto-cropped to uniform size in sidebar.
                    </p>
                    {logoError && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle size={11} strokeWidth={1.5} />
                        {logoError}
                      </p>
                    )}
                  </div>

                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </div>
              </div>

              {/* ── Name ─────────────────────────────────────────────────── */}
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
                    <span className="text-sm text-black dark:text-white">{wsName}</span>
                    {nameSaved && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <Check size={12} strokeWidth={2} /> Saved
                      </span>
                    )}
                    <button
                      onClick={() => setEditingName(true)}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
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
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-semibold text-black dark:text-white">Manage Access</h2>
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
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
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
                      'border-b border-zinc-50 dark:border-zinc-800 last:border-0 transition-colors',
                      isRemoving ? 'opacity-40' : 'hover:bg-zinc-50/40 dark:hover:bg-zinc-800/40'
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
                          <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 select-none">
                            {initials}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-black dark:text-white text-sm">
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
                            className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors disabled:pointer-events-none"
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

        {/* ── Role legend (admin only) ───────────────────────────────────── */}
        {isAdmin && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-[#1A1A1A] rounded-xl">
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium mb-2 bg-zinc-900 text-white rounded">
                Admin
              </span>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Full access — can manage tasks, files, and settings.</p>
            </div>
            <div className="p-4 border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-[#1A1A1A] rounded-xl">
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium mb-2 bg-violet-100 text-violet-700 rounded">
                Designer
              </span>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Designer access — can submit invoices and manage assigned tasks.</p>
            </div>
            <div className="p-4 border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-[#1A1A1A] rounded-xl">
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium mb-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded">
                Client
              </span>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Client access — can view and update their board.</p>
            </div>
          </div>
        )}

        {/* ── Danger Zone ─────────────────────────────────────────────────── */}
        {isAdmin && (
          <div className="border border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/10 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-red-100 dark:border-red-900">
              <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>
              <p className="text-xs text-red-500/80 mt-0.5">
                Irreversible actions — proceed with caution.
              </p>
            </div>
            <div className="px-6 py-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-white">Delete this workspace</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Permanently deletes the workspace, all tasks, files, and member data. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); setDeleteError(null) }}
                className="shrink-0 h-8 px-4 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
              >
                Delete Workspace
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Delete Workspace confirmation modal ───────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={(v) => { if (!isDeletePending) setDeleteOpen(v) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-700">Delete Workspace</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong className="text-zinc-900">{workspace.name}</strong> and all associated tasks, files, and members. This action <strong>cannot be undone</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {deleteError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                {deleteError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-600">
                Type <strong className="font-mono text-zinc-900">{workspace.name}</strong> to confirm
              </Label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={workspace.name}
                disabled={isDeletePending}
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" rounded="sm" onClick={() => setDeleteOpen(false)} disabled={isDeletePending}>
              Cancel
            </Button>
            <button
              onClick={handleDeleteWorkspace}
              disabled={deleteConfirm !== workspace.name || isDeletePending}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeletePending && <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />}
              {isDeletePending ? 'Deleting…' : 'Confirm Delete'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
