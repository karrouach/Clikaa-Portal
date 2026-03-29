'use client'

import { useState, useTransition } from 'react'
import { UserPlus, Loader2, AlertCircle, Check } from 'lucide-react'
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
import { inviteWorkspaceMember } from '../settings/workspace-settings-actions'

type Role = 'admin' | 'client' | 'designer' | 'developer' | 'marketer' | 'project_manager' | 'internal_team'

export function InviteButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen]               = useState(false)
  const [email, setEmail]             = useState('')
  const [name, setName]               = useState('')
  const [role, setRole]               = useState<Role>('client')
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState(false)
  const [isPending, startTransition]  = useTransition()

  function handleClose() {
    if (isPending) return
    setOpen(false)
    setEmail('')
    setName('')
    setRole('client')
    setError(null)
    setSuccess(false)
  }

  function handleInvite() {
    setError(null)
    startTransition(async () => {
      const result = await inviteWorkspaceMember({
        workspaceId,
        email,
        fullName: name,
        role,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => handleClose(), 1500)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-black transition-colors"
      >
        <UserPlus size={11} strokeWidth={1.5} />
        Invite
      </button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Add someone to this workspace. Existing portal users are added instantly — new users receive an email invite.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}
            {success && (
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending || success}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600">
                Full name <span className="text-zinc-400 text-[10px] normal-case">(optional — for new users)</span>
              </Label>
              <Input
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending || success}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={isPending || success}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client — Board access</SelectItem>
                  <SelectItem value="internal_team">Internal Team — Team member</SelectItem>
                  <SelectItem value="admin">Admin — Full access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" rounded="sm" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              rounded="sm"
              onClick={handleInvite}
              disabled={!email.trim() || isPending || success}
            >
              {isPending && <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />}
              {isPending ? 'Adding…' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
