'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus, AlertCircle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { createWorkspace, type CreateWorkspaceState } from '@/app/dashboard/workspace-actions'

// ─── Submit button ────────────────────────────────────────────────────────────
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        w-full h-11 flex items-center justify-center gap-2
        bg-black text-white text-sm font-medium tracking-wide
        hover:bg-zinc-800 active:bg-zinc-900
        transition-colors duration-150
        disabled:opacity-60 disabled:cursor-not-allowed
      "
    >
      {pending ? (
        <>
          <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
          Creating…
        </>
      ) : (
        'Create workspace'
      )}
    </button>
  )
}

// ─── Dialog (form only) ───────────────────────────────────────────────────────
interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function WorkspaceDialog({ open, onOpenChange }: DialogProps) {
  const [state, formAction] = useActionState<CreateWorkspaceState | null, FormData>(
    createWorkspace,
    null
  )
  const formRef = useRef<HTMLFormElement>(null)

  // Reset the form every time the dialog is closed.
  useEffect(() => {
    if (!open) formRef.current?.reset()
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription>
            Give your client workspace a name. You can edit it later from settings.
          </DialogDescription>
        </DialogHeader>

        {state?.error && (
          <div className="mt-4 flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 text-red-700 text-sm">
            <AlertCircle size={15} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <form ref={formRef} action={formAction} className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="ws-name"
              className="block text-xs font-medium text-zinc-700 tracking-wide uppercase"
            >
              Workspace name
            </label>
            <input
              id="ws-name"
              name="name"
              type="text"
              required
              autoFocus
              autoComplete="off"
              maxLength={80}
              placeholder="e.g. Acme Corp Rebrand"
              className="
                w-full h-10 px-0 py-2
                border-0 border-b border-zinc-200
                bg-transparent text-sm text-black placeholder:text-zinc-400
                focus:outline-none focus:border-black
                transition-colors duration-150
              "
            />
          </div>

          <div className="pt-2">
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── NewWorkspaceButton — trigger + dialog state in one component ─────────────
// Render this wherever a "+ New Workspace" button is needed.
interface NewWorkspaceButtonProps {
  variant?: 'default' | 'ghost'
}

export function NewWorkspaceButton({ variant = 'default' }: NewWorkspaceButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          variant === 'ghost'
            ? `
                flex items-center gap-1.5 text-sm text-zinc-500
                hover:text-black transition-colors duration-150
              `
            : `
                flex items-center gap-1.5 h-9 px-4
                bg-black text-white text-sm font-medium
                hover:bg-zinc-800 active:bg-zinc-900
                transition-colors duration-150
              `
        }
      >
        <Plus size={14} strokeWidth={2} />
        New Workspace
      </button>

      <WorkspaceDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
