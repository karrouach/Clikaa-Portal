import type { Metadata } from 'next'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Invoices' }

const INVOICES = [
  {
    id: 'INV-001',
    client: 'Acme Corporation',
    project: 'Brand Identity Redesign',
    amount: '$2,500.00',
    issued: 'Jan 15, 2026',
    due: 'Jan 30, 2026',
    status: 'paid' as const,
  },
  {
    id: 'INV-002',
    client: 'TechStart Inc.',
    project: 'Website & UX Overhaul',
    amount: '$4,000.00',
    issued: 'Feb 1, 2026',
    due: 'Feb 15, 2026',
    status: 'pending' as const,
  },
  {
    id: 'INV-003',
    client: 'Studio X',
    project: 'Campaign Assets Q1',
    amount: '$1,800.00',
    issued: 'Jan 28, 2026',
    due: 'Feb 11, 2026',
    status: 'paid' as const,
  },
  {
    id: 'INV-004',
    client: 'Horizon Ltd.',
    project: 'Motion Graphics Package',
    amount: '$3,200.00',
    issued: 'Jan 5, 2026',
    due: 'Jan 20, 2026',
    status: 'overdue' as const,
  },
  {
    id: 'INV-005',
    client: 'Bright Media',
    project: 'Social Media Kit',
    amount: '$1,000.00',
    issued: 'Feb 15, 2026',
    due: 'Mar 1, 2026',
    status: 'pending' as const,
  },
]

const STATUS_STYLES = {
  paid:    'bg-emerald-50 text-emerald-700 border-emerald-100',
  pending: 'bg-amber-50   text-amber-700   border-amber-100',
  overdue: 'bg-red-50     text-red-700     border-red-100',
}

const STATUS_LABELS = {
  paid:    'Paid',
  pending: 'Pending',
  overdue: 'Overdue',
}

export default function InvoicesPage() {
  const totalPending = INVOICES
    .filter((i) => i.status !== 'paid')
    .reduce((acc, i) => acc + parseFloat(i.amount.replace(/[$,]/g, '')), 0)

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Track billing and payments across all your clients.
          </p>
        </div>

        {/* Summary pill */}
        <div className="text-right">
          <p className="text-xs text-zinc-400 uppercase tracking-widest">Outstanding</p>
          <p className="text-2xl font-semibold text-black mt-0.5">
            ${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* ── Mobile card list — sm:hidden ──────────────────────────────── */}
      <div className="sm:hidden space-y-3">
        {INVOICES.map((inv) => (
          <div
            key={inv.id}
            className="bg-white border border-zinc-100 rounded-xl p-4"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-black truncate">{inv.client}</p>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">{inv.project}</p>
              </div>
              <span
                className={cn(
                  'shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full',
                  STATUS_STYLES[inv.status]
                )}
              >
                {STATUS_LABELS[inv.status]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-zinc-400">{inv.id}</span>
              <span className="text-sm font-semibold text-black tabular-nums">{inv.amount}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[11px] text-zinc-400">Issued {inv.issued}</span>
              <span className="text-zinc-200">·</span>
              <span className="text-[11px] text-zinc-400">Due {inv.due}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop table — hidden on mobile ──────────────────────────── */}
      <div className="hidden sm:block bg-white border border-zinc-100 overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden md:table-cell whitespace-nowrap">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden lg:table-cell whitespace-nowrap">
                  Issued
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden lg:table-cell whitespace-nowrap">
                  Due
                </th>
                <th className="px-6 py-3 text-right text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {INVOICES.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500 whitespace-nowrap">{inv.id}</td>
                  <td className="px-6 py-4 font-medium text-black whitespace-nowrap">{inv.client}</td>
                  <td className="px-6 py-4 text-zinc-500 hidden md:table-cell">{inv.project}</td>
                  <td className="px-6 py-4 text-zinc-400 hidden lg:table-cell whitespace-nowrap">{inv.issued}</td>
                  <td className="px-6 py-4 text-zinc-400 hidden lg:table-cell whitespace-nowrap">{inv.due}</td>
                  <td className="px-6 py-4 text-right font-medium text-black tabular-nums whitespace-nowrap">
                    {inv.amount}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 text-xs font-medium border',
                        STATUS_STYLES[inv.status]
                      )}
                    >
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
