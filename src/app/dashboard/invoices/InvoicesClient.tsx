'use client'

import { useState, useMemo } from 'react'
import { Plus, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CreateInvoiceModal } from './CreateInvoiceModal'
import { InvoiceViewPanel } from './InvoiceViewPanel'

// ─── Types ────────────────────────────────────────────────────────────────────
export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'failed' | 'cancelled' | 'processing'

export interface Invoice {
  id: string          // display ID (INV-001 style) or uuid from DB
  dbId?: string       // actual DB uuid (when from real data)
  invoice_number?: string
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
  draft:      'bg-zinc-100    text-zinc-600     border-zinc-200',
  paid:       'bg-emerald-50  text-emerald-700  border-emerald-100',
  pending:    'bg-amber-50    text-amber-700    border-amber-100',
  overdue:    'bg-red-50      text-red-700      border-red-100',
  failed:     'bg-red-100     text-red-800      border-red-200',
  cancelled:  'bg-zinc-100    text-zinc-500     border-zinc-200',
  processing: 'bg-blue-50     text-blue-700     border-blue-100',
}

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:      'Draft',
  paid:       'Paid',
  pending:    'Pending',
  overdue:    'Overdue',
  failed:     'Failed',
  cancelled:  'Cancelled',
  processing: 'Processing',
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
  const [filterMonth, setFilterMonth] = useState<string>('all')

  // ── Derive available months from invoice data ──────────────────────────────
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    invoices.forEach(inv => {
      const iso = inv.rawData?.issue_date as string | undefined
      if (iso) {
        months.add(iso.slice(0, 7))
      } else if (inv.issued && inv.issued !== '—') {
        const d = new Date(inv.issued)
        if (!isNaN(d.getTime())) months.add(d.toISOString().slice(0, 7))
      }
    })
    return [...months].sort().reverse()
  }, [invoices])

  function formatMonth(ym: string) {
    const [year, month] = ym.split('-')
    return new Date(parseInt(year), parseInt(month) - 1, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const filteredInvoices = useMemo(() => {
    if (filterMonth === 'all') return invoices
    return invoices.filter(inv => {
      const iso = inv.rawData?.issue_date as string | undefined
      if (iso) return iso.startsWith(filterMonth)
      if (inv.issued && inv.issued !== '—') {
        const d = new Date(inv.issued)
        return !isNaN(d.getTime()) && d.toISOString().startsWith(filterMonth)
      }
      return false
    })
  }, [invoices, filterMonth])

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

  function handleExport() {
    const headers = ['Invoice #', 'Client', 'Project', 'Amount', 'Status', 'Issued', 'Due']
    const rows = filteredInvoices.map((inv) => [
      inv.invoice_number ?? inv.id,
      inv.client,
      inv.project || '',
      inv.amount,
      STATUS_LABELS[inv.status],
      inv.issued,
      inv.due,
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filterMonth === 'all' ? 'invoices-export.csv' : `invoices-${filterMonth}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── KPI calculations ──────────────────────────────────────────────────────
  const kpiAll     = invoices.length
  const kpiDraft   = invoices.filter(i => i.status === 'draft').length
  const kpiOpen    = invoices.filter(i => i.status === 'pending').length
  const kpiOverdue = invoices.filter(i => i.status === 'overdue').length
  const kpiPaid    = invoices.filter(i => i.status === 'paid').length

  const totalPaidAmount = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + parseFloat(i.amount.replace(/[$,]/g, '')), 0)

  const KPI_CARDS = [
    { label: 'All Invoices',   value: kpiAll,     sub: null },
    { label: 'Draft / Pending', value: kpiDraft + kpiOpen, sub: `${kpiDraft} draft · ${kpiOpen} pending` },
    { label: 'Open',           value: kpiOpen,    sub: null },
    { label: 'Overdue',        value: kpiOverdue, sub: null, highlight: kpiOverdue > 0 },
    { label: 'Paid',           value: kpiPaid,    sub: `$${totalPaidAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}` },
  ]

  return (
    <div className="animate-fade-in">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white tracking-tight">
            {isClient ? 'My Invoices' : 'Invoices'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isClient
              ? 'Review and download your invoices.'
              : 'Track billing and payments across all your clients.'}
          </p>
        </div>

        {!isClient && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {/* Month filter */}
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="h-9 px-3 text-sm bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-600 focus:outline-none transition-colors duration-150 cursor-pointer"
            >
              <option value="all">All Time</option>
              {availableMonths.map(ym => (
                <option key={ym} value={ym}>{formatMonth(ym)}</option>
              ))}
            </select>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 h-9 px-3.5 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors duration-150"
            >
              <Download size={13} strokeWidth={1.5} />
              Export CSV
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 h-9 px-4 bg-black dark:bg-white text-white dark:text-black text-sm font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-gray-200 active:bg-zinc-900 transition-colors duration-150"
            >
              <Plus size={14} strokeWidth={1.5} />
              Create Invoice
            </button>
          </div>
        )}
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      {!isClient && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {KPI_CARDS.map(({ label, value, sub, highlight }) => (
            <div
              key={label}
              className={cn(
                'bg-white dark:bg-[#1A1A1A] border rounded-xl px-4 py-4 flex flex-col gap-1',
                highlight ? 'border-red-100 dark:border-red-900 bg-red-50/30 dark:bg-red-950/20' : 'border-zinc-100 dark:border-zinc-800'
              )}
            >
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">{label}</p>
              <p className={cn('text-2xl font-semibold tabular-nums', highlight ? 'text-red-600' : 'text-black dark:text-white')}>
                {value}
              </p>
              {sub && <p className="text-[11px] text-zinc-400">{sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Mobile card list ──────────────────────────────────────────────── */}
      <div className="sm:hidden space-y-3">
        {filteredInvoices.length === 0 && (
          <p className="text-sm text-zinc-400 text-center py-8">No invoices for this period.</p>
        )}
        {filteredInvoices.map(inv => (
          <button
            key={inv.id}
            onClick={() => !isClient && setViewInvoice(inv)}
            className={cn(
              'w-full text-left bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl p-4 transition-colors',
              isClient ? 'cursor-default' : 'hover:border-zinc-200 dark:hover:border-zinc-700 active:bg-zinc-50 dark:active:bg-zinc-800',
            )}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-black dark:text-white truncate">{inv.client}</p>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">{inv.project || inv.id}</p>
              </div>
              <span className={cn('shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full', STATUS_STYLES[inv.status])}>
                {STATUS_LABELS[inv.status]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-zinc-400">{inv.id}</span>
              <span className="text-sm font-semibold text-black dark:text-white tabular-nums">{inv.amount}</span>
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
      <div className="hidden sm:block bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">Invoice</th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">Client</th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden lg:table-cell whitespace-nowrap">Issued</th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden lg:table-cell whitespace-nowrap">Due</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">Amount</th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                {isClient && <th className="px-4 py-3 w-10" />}
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-400">
                    No invoices for this period.
                  </td>
                </tr>
              )}
              {filteredInvoices.map(inv => (
                <tr
                  key={inv.id}
                  onClick={() => !isClient && setViewInvoice(inv)}
                  className={cn(
                    'border-b border-zinc-50 dark:border-zinc-800 last:border-0 transition-colors group',
                    isClient ? '' : 'hover:bg-zinc-50/60 dark:hover:bg-zinc-800/60 cursor-pointer',
                  )}
                >
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500 whitespace-nowrap">{inv.invoice_number ?? inv.id}</td>
                  <td className="px-6 py-4 font-medium text-black dark:text-white whitespace-nowrap">{inv.client}</td>
                  <td className="px-6 py-4 text-zinc-400 hidden lg:table-cell whitespace-nowrap">{inv.issued}</td>
                  <td className="px-6 py-4 text-zinc-400 hidden lg:table-cell whitespace-nowrap">{inv.due}</td>
                  <td className="px-6 py-4 text-right font-medium text-black dark:text-white tabular-nums whitespace-nowrap">{inv.amount}</td>
                  <td className="px-6 py-4">
                    <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full', STATUS_STYLES[inv.status])}>
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </td>
                  {isClient && (
                    <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setViewInvoice(inv)}
                        className="px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 rounded-lg transition-colors"
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
