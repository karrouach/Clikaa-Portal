'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CreateInvoiceModal } from './CreateInvoiceModal'
import { InvoiceViewPanel } from './InvoiceViewPanel'

// ─── Types ────────────────────────────────────────────────────────────────────
export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'failed' | 'cancelled'

export interface Invoice {
  id: string          // display ID (INV-001 style) or uuid from DB
  dbId?: string       // actual DB uuid (when from real data)
  client: string
  project: string
  amount: string
  issued: string
  due: string
  status: InvoiceStatus
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawData?: any       // original DB row for edit mode
}

// ─── Shared styles ────────────────────────────────────────────────────────────
export const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft:     'bg-zinc-100    text-zinc-600     border-zinc-200',
  paid:      'bg-emerald-50  text-emerald-700  border-emerald-100',
  pending:   'bg-amber-50    text-amber-700    border-amber-100',
  overdue:   'bg-red-50      text-red-700      border-red-100',
  failed:    'bg-red-100     text-red-800      border-red-200',
  cancelled: 'bg-zinc-100    text-zinc-500     border-zinc-200',
}

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:     'Draft',
  paid:      'Paid',
  pending:   'Pending',
  overdue:   'Overdue',
  failed:    'Failed',
  cancelled: 'Cancelled',
}

// ─── Mock data (fallback when no DB data) ─────────────────────────────────────
const MOCK_INVOICES: Invoice[] = [
  { id: 'INV-001', client: 'Acme Corporation',  project: 'Brand Identity Redesign',   amount: '$2,500.00', issued: 'Jan 15, 2026', due: 'Jan 30, 2026', status: 'paid'    },
  { id: 'INV-002', client: 'TechStart Inc.',    project: 'Website & UX Overhaul',      amount: '$4,000.00', issued: 'Feb 1, 2026',  due: 'Feb 15, 2026', status: 'pending' },
  { id: 'INV-003', client: 'Studio X',          project: 'Campaign Assets Q1',         amount: '$1,800.00', issued: 'Jan 28, 2026', due: 'Feb 11, 2026', status: 'paid'    },
  { id: 'INV-004', client: 'Horizon Ltd.',      project: 'Motion Graphics Package',    amount: '$3,200.00', issued: 'Jan 5, 2026',  due: 'Jan 20, 2026', status: 'overdue' },
  { id: 'INV-005', client: 'Bright Media',      project: 'Social Media Kit',           amount: '$1,000.00', issued: 'Feb 15, 2026', due: 'Mar 1, 2026',  status: 'pending' },
]

// ─── Props ────────────────────────────────────────────────────────────────────
interface InvoicesClientProps {
  initialInvoices?: Invoice[]
  workspaces?: { id: string; name: string }[]
  isClient?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────
export function InvoicesClient({ initialInvoices, workspaces = [], isClient = false }: InvoicesClientProps) {
  const [invoices, setInvoices]       = useState<Invoice[]>(initialInvoices?.length ? initialInvoices : MOCK_INVOICES)
  const [createOpen, setCreateOpen]   = useState(false)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null)

  const totalPending = invoices
    .filter(i => i.status === 'pending' || i.status === 'overdue')
    .reduce((sum, i) => sum + parseFloat(i.amount.replace(/[$,]/g, '')), 0)

  function handleMarkPaid(id: string) {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'paid' } : i))
    setViewInvoice(prev => prev?.id === id ? { ...prev, status: 'paid' } : prev)
  }

  function handleStatusChange(id: string, status: InvoiceStatus) {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    setViewInvoice(prev => prev?.id === id ? { ...prev, status } : prev)
  }

  function handleDelete(id: string) {
    setInvoices(prev => prev.filter(i => i.id !== id))
    setViewInvoice(null)
  }

  function handleInvoiceCreated(invoice: Invoice) {
    if (editInvoice) {
      setInvoices(prev => prev.map(i => i.id === editInvoice.id ? invoice : i))
    } else {
      setInvoices(prev => [invoice, ...prev])
    }
  }

  function handleEdit(invoice: Invoice) {
    setViewInvoice(null)
    setEditInvoice(invoice)
    setCreateOpen(true)
  }

  function handleCreateClose(open: boolean) {
    setCreateOpen(open)
    if (!open) setEditInvoice(null)
  }

  return (
    <div className="animate-fade-in">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-black tracking-tight">
            {isClient ? 'My Invoices' : 'Invoices'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isClient
              ? 'Review and download your invoices.'
              : 'Track billing and payments across all your clients.'}
          </p>
        </div>

        {!isClient && (
          <div className="flex items-start gap-4 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-zinc-400 uppercase tracking-widest">Outstanding</p>
              <p className="text-2xl font-semibold text-black mt-0.5">
                ${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 h-9 px-4 bg-black text-white text-sm font-medium rounded-lg hover:bg-zinc-800 active:bg-zinc-900 transition-colors duration-150"
            >
              <Plus size={14} strokeWidth={1.5} />
              Create Invoice
            </button>
          </div>
        )}
      </div>

      {/* ── Mobile card list ──────────────────────────────────────────────── */}
      <div className="sm:hidden space-y-3">
        {invoices.map(inv => (
          <button
            key={inv.id}
            onClick={() => !isClient && setViewInvoice(inv)}
            className={cn(
              'w-full text-left bg-white border border-zinc-100 rounded-xl p-4 transition-colors',
              isClient ? 'cursor-default' : 'hover:border-zinc-200 active:bg-zinc-50',
            )}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-black truncate">{inv.client}</p>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">{inv.project || inv.id}</p>
              </div>
              <span className={cn('shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full', STATUS_STYLES[inv.status])}>
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
          </button>
        ))}
      </div>

      {/* ── Desktop table ─────────────────────────────────────────────────── */}
      <div className="hidden sm:block bg-white border border-zinc-100 overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">Invoice</th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">Client</th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden md:table-cell whitespace-nowrap">Project</th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden lg:table-cell whitespace-nowrap">Issued</th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden lg:table-cell whitespace-nowrap">Due</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">Amount</th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                {isClient && <th className="px-4 py-3 w-10" />}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr
                  key={inv.id}
                  onClick={() => !isClient && setViewInvoice(inv)}
                  className={cn(
                    'border-b border-zinc-50 last:border-0 transition-colors group',
                    isClient ? '' : 'hover:bg-zinc-50/60 cursor-pointer',
                  )}
                >
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500 whitespace-nowrap">{inv.id}</td>
                  <td className="px-6 py-4 font-medium text-black whitespace-nowrap group-hover:text-black">{inv.client}</td>
                  <td className="px-6 py-4 text-zinc-500 hidden md:table-cell">{inv.project}</td>
                  <td className="px-6 py-4 text-zinc-400 hidden lg:table-cell whitespace-nowrap">{inv.issued}</td>
                  <td className="px-6 py-4 text-zinc-400 hidden lg:table-cell whitespace-nowrap">{inv.due}</td>
                  <td className="px-6 py-4 text-right font-medium text-black tabular-nums whitespace-nowrap">{inv.amount}</td>
                  <td className="px-6 py-4">
                    <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full', STATUS_STYLES[inv.status])}>
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </td>
                  {isClient && (
                    <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setViewInvoice(inv)}
                        className="px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:text-black border border-zinc-200 hover:border-zinc-300 rounded-lg transition-colors"
                      >
                        View
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <CreateInvoiceModal
        open={createOpen}
        onOpenChange={handleCreateClose}
        workspaces={workspaces}
        editInvoice={editInvoice}
        onCreated={handleInvoiceCreated}
      />
      <InvoiceViewPanel
        invoice={viewInvoice}
        onClose={() => setViewInvoice(null)}
        onMarkPaid={handleMarkPaid}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        onEdit={handleEdit}
        isClient={isClient}
      />
    </div>
  )
}
