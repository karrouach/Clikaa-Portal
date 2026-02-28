import type { Metadata } from 'next'
import { Paperclip } from 'lucide-react'

export const metadata: Metadata = { title: 'Files' }

export default function WorkspaceFilesPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-black tracking-tight">Files</h1>
          <p className="mt-1 text-sm text-zinc-500">
            All files and attachments shared in this workspace.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
            <Paperclip size={20} strokeWidth={1.5} className="text-zinc-400" />
          </div>
          <h2 className="text-sm font-medium text-zinc-900 mb-1">No files yet</h2>
          <p className="text-sm text-zinc-400 max-w-xs">
            Workspace-level file management is coming soon. Task attachments are
            available inside each task card on the Board.
          </p>
        </div>
      </div>
    </div>
  )
}
