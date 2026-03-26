'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Check, RotateCcw, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { approveTask, requestRevision } from './client-actions'

interface ApprovalActionsProps {
  taskId: string
  taskTitle: string
  onRemove: (id: string) => void
}

export function ApprovalActions({ taskId, taskTitle, onRemove }: ApprovalActionsProps) {
  const [approving, startApproveTransition] = useTransition()
  const [revising, startReviseTransition]   = useTransition()
  const [revisionOpen, setRevisionOpen]     = useState(false)
  const [feedback, setFeedback]             = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (revisionOpen) textareaRef.current?.focus()
  }, [revisionOpen])

  function handleApprove() {
    onRemove(taskId) // optimistic
    startApproveTransition(async () => {
      try {
        await approveTask(taskId)
        toast.success('Approved successfully.')
      } catch {
        toast.error('Failed to approve. Please try again.')
      }
    })
  }

  function handleRevisionSubmit() {
    const fb = feedback.trim()
    if (!fb) return
    setRevisionOpen(false)
    setFeedback('')
    onRemove(taskId) // optimistic
    startReviseTransition(async () => {
      try {
        await requestRevision(taskId, fb)
        toast.success('Revision requested. The team has been notified.')
      } catch {
        toast.error('Failed to request revision. Please try again.')
      }
    })
  }

  const isPending = approving || revising

  return (
    <>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="flex-1 h-8 flex items-center justify-center gap-1.5 text-xs font-medium bg-black text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {approving ? (
            <Loader2 size={11} strokeWidth={2} className="animate-spin" />
          ) : (
            <Check size={11} strokeWidth={2.5} />
          )}
          Approve
        </button>
        <button
          onClick={() => setRevisionOpen(true)}
          disabled={isPending}
          className="flex-1 h-8 flex items-center justify-center gap-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw size={11} strokeWidth={1.5} />
          Request Revision
        </button>
      </div>

      {/* ── Revision feedback modal ──────────────────────────────────────── */}
      {revisionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setRevisionOpen(false)}
          />

          {/* Panel */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="pr-2 min-w-0">
                <h3 className="text-sm font-semibold text-black">Request a Revision</h3>
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{taskTitle}</p>
              </div>
              <button
                onClick={() => setRevisionOpen(false)}
                className="shrink-0 w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-700 rounded transition-colors"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRevisionSubmit()
              }}
              placeholder="What needs to be changed?"
              rows={4}
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-400 placeholder:text-zinc-400"
            />

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setRevisionOpen(false)}
                className="flex-1 h-9 text-xs font-medium border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRevisionSubmit}
                disabled={!feedback.trim() || revising}
                className="flex-1 h-9 text-xs font-medium bg-black text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {revising ? (
                  <Loader2 size={11} strokeWidth={2} className="animate-spin mx-auto" />
                ) : (
                  'Submit Feedback'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
