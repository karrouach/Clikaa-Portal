'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Clock, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { markDesignerInvoicePaid } from './designer-invoice-actions'
import { toast } from 'sonner'

interface InvoiceItem {
  id: string
  designer_id?: string
  invoice_number: string
  amount: number
  status: 'pending' | 'paid'
  period_start: string
  period_end: string
  paid_at: string | null
  created_at: string
}

interface DesignerInfo {
  id: string
  name: string
  monthly_retainer: number | null
}

interface Props {
  invoices: InvoiceItem[]
  isAdmin: boolean
  designers: DesignerInfo[]
  designerName: string
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatPeriod(start: string, end: string) {
  const s = new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const e = new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${s} – ${e}`
}

export function DesignerInvoicesClient({ invoices: initialInvoices, isAdmin, designers, designerName }: Props) {
  const [invoices, setInvoices] = useState<InvoiceItem[]>(initialInvoices)
  const [isPending, startTransition] = useTransition()

  function handleMarkPaid(invoiceId: string) {
    startTransition(async () => {
      try {
        await markDesignerInvoicePaid(invoiceId)
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === invoiceId ? { ...inv, status: 'paid', paid_at: new Date().toISOString() } : inv
          )
        )
        toast.success('Invoice marked as paid')
      } catch {
        toast.error('Failed to update invoice')
      }
    })
  }

  const pending = invoices.filter((i) => i.status === 'pending')
  const paid    = invoices.filter((i) => i.status === 'paid')
  const totalPending = pending.reduce((s, i) => s + i.amount, 0)

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black tracking-tight">
          {isAdmin ? 'Designer Invoices' : 'My Invoices'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isAdmin
            ? 'View and manage retainer invoices for all designers.'
            : `Your monthly retainer invoices, ${designerName}.`}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-zinc-100 rounded-xl p-5">
          <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-3">Outstanding</p>
          <p className="text-2xl font-semibold text-black">{formatCurrency(totalPending)}</p>
          <p className="mt-1 text-xs text-zinc-400">{pending.length} invoice{pending.length !== 1 ? 's' : ''} pending</p>
        </div>
        <div className="bg-white border border-zinc-100 rounded-xl p-5">
          <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-3">Total Paid</p>
          <p className="text-2xl font-semibold text-black">
            {formatCurrency(paid.reduce((s, i) => s + i.amount, 0))}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{paid.length} invoice{paid.length !== 1 ? 's' : ''} paid</p>
        </div>
        {isAdmin && designers.length > 0 && (
          <div className="bg-white border border-zinc-100 rounded-xl p-5">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-3">Designers</p>
            <p className="text-2xl font-semibold text-black">{designers.length}</p>
            <p className="mt-1 text-xs text-zinc-400">with retainer agreements</p>
          </div>
        )}
      </div>

      {/* Designer retainer info (admin only) */}
      {isAdmin && designers.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-black mb-3">Designer Retainers</h2>
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-5 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Designer</th>
                  <th className="px-5 py-3 text-right text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Monthly Rate</th>
                </tr>
              </thead>
              <tbody>
                {designers.map((d) => (
                  <tr key={d.id} className="border-b border-zinc-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-black">{d.name}</td>
                    <td className="px-5 py-3 text-right text-zinc-700 tabular-nums">
                      {d.monthly_retainer ? formatCurrency(d.monthly_retainer) : <span className="text-zinc-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice list */}
      <div>
        <h2 className="text-sm font-semibold text-black mb-3">All Invoices</h2>
        {invoices.length === 0 ? (
          <div className="bg-white border border-zinc-100 rounded-xl flex flex-col items-center justify-center py-16 text-center">
            <Receipt size={28} strokeWidth={1} className="text-zinc-200 mb-3" />
            <p className="text-sm text-zinc-400">No invoices yet.</p>
            <p className="text-xs text-zinc-300 mt-1">
              {isAdmin ? 'Invoices are auto-generated on the 1st of each month.' : 'Your invoices will appear here.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="px-5 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Invoice</th>
                    {isAdmin && (
                      <th className="px-5 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden md:table-cell">Designer</th>
                    )}
                    <th className="px-5 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Period</th>
                    <th className="px-5 py-3 text-right text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Amount</th>
                    <th className="px-5 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Status</th>
                    {isAdmin && (
                      <th className="px-5 py-3 text-right text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const designer = isAdmin ? designers.find((d) => d.id === inv.designer_id) : null
                    return (
                      <tr key={inv.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/40 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-black">{inv.invoice_number}</td>
                        {isAdmin && (
                          <td className="px-5 py-3.5 text-zinc-500 hidden md:table-cell">
                            {designer?.name ?? '—'}
                          </td>
                        )}
                        <td className="px-5 py-3.5 text-zinc-500 text-xs whitespace-nowrap">
                          {formatPeriod(inv.period_start, inv.period_end)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium text-black tabular-nums">
                          {formatCurrency(inv.amount)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium border rounded-full whitespace-nowrap',
                            inv.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                          )}>
                            {inv.status === 'paid' ? <CheckCircle2 size={10} strokeWidth={2} /> : <Clock size={10} strokeWidth={2} />}
                            {inv.status === 'paid' ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3.5 text-right">
                            {inv.status === 'pending' && (
                              <button
                                onClick={() => handleMarkPaid(inv.id)}
                                disabled={isPending}
                                className="text-xs font-medium text-black hover:text-zinc-600 transition-colors disabled:opacity-40"
                              >
                                Mark Paid
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
