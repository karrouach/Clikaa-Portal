'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
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

// ─── Mock workspace members ────────────────────────────────────────────────
const INITIAL_MEMBERS = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah@clikaa.com',
    role: 'admin',
    initials: 'SC',
    isYou: true,
  },
  {
    id: '2',
    name: 'Marcus Webb',
    email: 'marcus@clikaa.com',
    role: 'editor',
    initials: 'MW',
    isYou: false,
  },
  {
    id: '3',
    name: 'Client User',
    email: 'contact@acmecorp.com',
    role: 'viewer',
    initials: 'CU',
    isYou: false,
  },
]

type Role = 'admin' | 'editor' | 'viewer'

const ROLE_META: Record<Role, { label: string; description: string; badge: string }> = {
  admin:  { label: 'Admin',  description: 'Full access',            badge: 'bg-zinc-900  text-white' },
  editor: { label: 'Editor', description: 'Can edit tasks & files', badge: 'bg-blue-50   text-blue-700' },
  viewer: { label: 'Viewer', description: 'Read-only client',       badge: 'bg-zinc-100  text-zinc-500' },
}

export default function WorkspaceSettingsPage() {
  const [members, setMembers] = useState(INITIAL_MEMBERS)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('viewer')

  function handleRoleChange(memberId: string, newRole: Role) {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    )
  }

  function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviteOpen(false)
    setInviteEmail('')
    setInviteRole('viewer')
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-8 max-w-3xl">

        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-black tracking-tight">
            Workspace Settings
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage members and access control for this workspace.
          </p>
        </div>

        {/* ── Manage Access card ───────────────────────────────────────────── */}
        <div className="bg-white border border-zinc-100">

          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
            <div>
              <h2 className="text-sm font-semibold text-black">Manage Access</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {members.length} member{members.length !== 1 ? 's' : ''} in this workspace
              </p>
            </div>

            <Button
              size="sm"
              rounded="sm"
              onClick={() => setInviteOpen(true)}
              className="gap-1.5 text-xs"
            >
              <UserPlus size={13} strokeWidth={1.5} />
              Invite Member
            </Button>
          </div>

          {/* Member table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest w-44">
                  Role
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/40 transition-colors"
                >
                  {/* Member info */}
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-semibold text-zinc-600 select-none">
                        {member.initials}
                      </div>
                      <div>
                        <p className="font-medium text-black">
                          {member.name}
                          {member.isYou && (
                            <span className="ml-1.5 text-[10px] text-zinc-400 font-normal">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-400">{member.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role select */}
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'shrink-0 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium',
                          ROLE_META[member.role as Role]?.badge
                        )}
                      >
                        {ROLE_META[member.role as Role]?.label}
                      </span>
                      {!member.isYou && (
                        <Select
                          value={member.role}
                          onValueChange={(val) => handleRoleChange(member.id, val as Role)}
                        >
                          <SelectTrigger className="w-36 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Role legend ──────────────────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {(Object.entries(ROLE_META) as [Role, typeof ROLE_META[Role]][]).map(
            ([key, { label, description }]) => (
              <div key={key} className="p-4 border border-zinc-100 bg-white">
                <span
                  className={cn(
                    'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium mb-2',
                    ROLE_META[key].badge
                  )}
                >
                  {label}
                </span>
                <p className="text-xs text-zinc-500">{description}</p>
              </div>
            )
          )}
        </div>

      </div>

      {/* ── Invite Member dialog ─────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Send an invite link to add someone to this workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs uppercase tracking-wide text-zinc-600">
                Email address
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-role" className="text-xs uppercase tracking-wide text-zinc-600">
                Role
              </Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    Admin — Full access
                  </SelectItem>
                  <SelectItem value="editor">
                    Editor — Can edit tasks &amp; files
                  </SelectItem>
                  <SelectItem value="viewer">
                    Viewer — Read-only client
                  </SelectItem>
                </SelectContent>
              </Select>

              <p className="text-xs text-zinc-400 mt-1">
                {ROLE_META[inviteRole].description}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" rounded="sm" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button rounded="sm" onClick={handleInvite} disabled={!inviteEmail.trim()}>
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
