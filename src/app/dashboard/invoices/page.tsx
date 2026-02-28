import type { Metadata } from 'next'
import { Receipt } from 'lucide-react'

export const metadata: Metadata = { title: 'Invoices' }

export default function InvoicesPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black tracking-tight">Invoices</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage billing and invoices for your clients.</p>
      </div>

      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
          <Receipt size={20} strokeWidth={1.5} className="text-zinc-400" />
        </div>
        <h2 className="text-sm font-medium text-zinc-900 mb-1">No invoices yet</h2>
        <p className="text-sm text-zinc-400 max-w-xs">
          Invoice management is coming soon. You'll be able to create and send invoices to clients from here.
        </p>
      </div>
    </div>
  )
}
