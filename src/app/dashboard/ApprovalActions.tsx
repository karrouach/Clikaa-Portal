'use client'

import { useTransition } from 'react'
import { Check, RotateCcw, Loader2 } from 'lucide-react'
import { approveTask, requestRevision } from './client-actions'

interface ApprovalActionsProps {
  taskId: string
}

export function ApprovalActions({ taskId }: ApprovalActionsProps) {
  const [isPending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(() => approveTask(taskId))
  }

  function handleRevision() {
    startTransition(() => requestRevision(taskId))
  }

  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={handleApprove}
        disabled={isPending}
        className="flex-1 h-8 flex items-center justify-center gap-1.5 text-xs font-medium bg-black text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <Loader2 size={11} strokeWidth={2} className="animate-spin" />
        ) : (
          <Check size={11} strokeWidth={2.5} />
        )}
        Approve
      </button>
      <button
        onClick={handleRevision}
        disabled={isPending}
        className="flex-1 h-8 flex items-center justify-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RotateCcw size={11} strokeWidth={1.5} />
        Request Revision
      </button>
    </div>
  )
}
