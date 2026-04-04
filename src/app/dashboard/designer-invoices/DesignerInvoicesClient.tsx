'use client'

import { useState, useTransition, useRef, useMemo } from 'react'
import { CheckCircle2, Clock, Receipt, Plus, Upload, Loader2, AlertCircle, X, ChevronRight, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { markDesignerInvoicePaid, createDesignerInvoice, submitDesignerInvoice, updateMonthlyRetainer } from './designer-invoice-actions'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface InvoiceItem {
  id: string
  designer_id?: string
  invoice_number: string
  amount: number
  description?: string | null
  attachment_path?: string | null
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
  currentUserId?: string
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatPeriod(start: string, end: string) {
  const s = new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const e = new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${s} – ${e}`
}

function todayISO() { return new Date().toISOString().slice(0, 10) }
function firstOfMonth() {
  const d = new Date(); d.setDate(1)
  return d.toISOString().slice(0, 10)
}
function lastOfMonth() {
  const d = new Date(); d.setMonth(d.getMonth() + 1, 0)
  return d.toISOString().slice(0, 10)
}

export function DesignerInvoicesClient({ invoices: initialInvoices, isAdmin, designers: initialDesigners, designerName, currentUserId }: Props) {
  const [invoices, setInvoices] = useState<InvoiceItem[]>(initialInvoices)
  const [isPending, startTransition] = useTransition()

  // ── Retainer edit state ────────────────────────────────────────────────────
  const [localDesigners, setLocalDesigners] = useState<DesignerInfo[]>(initialDesigners)
  const [editingRetainer, setEditingRetainer] = useState<string | null>(null)
  const [retainerValue, setRetainerValue] = useState<string>('')
  const [savingRetainer, setSavingRetainer] = useState(false)

  function startEditRetainer(d: DesignerInfo) {
    setEditingRetainer(d.id)
    setRetainerValue(d.monthly_retainer != null ? String(d.monthly_retainer) : '')
  }

  async function saveRetainer(designerId: string) {
    const raw = parseFloat(retainerValue)
    const rate = isNaN(raw) || retainerValue.trim() === '' ? null : raw
    setSavingRetainer(true)
    const result = await updateMonthlyRetainer(designerId, rate)
    setSavingRetainer(false)
    if (result.error) { toast.error(result.error); return }
    setLocalDesigners(prev => prev.map(d => d.id === designerId ? { ...d, monthly_retainer: rate } : d))
    setEditingRetainer(null)
  }

  // ── Filter + detail slide-over ─────────────────────────────────────────────
  const [filterDesignerId, setFilterDesignerId] = useState<string>('all')
  const [filterMonth, setFilterMonth] = useState<string>('all')
  const [detailInvoice, setDetailInvoice] = useState<InvoiceItem | null>(null)

  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    invoices.forEach(inv => {
      if (inv.period_start) months.add(inv.period_start.slice(0, 7))
    })
    return [...months].sort().reverse()
  }, [invoices])

  function formatMonth(ym: string) {
    const [year, month] = ym.split('-')
    return new Date(parseInt(year), parseInt(month) - 1, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const displayedInvoices = useMemo(() => {
    return invoices.filter(i => {
      const matchesMember = filterDesignerId === 'all' || i.designer_id === filterDesignerId
      const matchesMonth  = filterMonth === 'all' || i.period_start.startsWith(filterMonth)
      return matchesMember && matchesMonth
    })
  }, [invoices, filterDesignerId, filterMonth])

  function handleExportCSV() {
    const headers = ['Invoice ID', 'Team Member', 'Period', 'Amount', 'Status']
    const rows = displayedInvoices.map(inv => {
      const member = designers.find(d => d.id === inv.designer_id)?.name ?? '—'
      return [
        inv.invoice_number,
        member,
        formatPeriod(inv.period_start, inv.period_end),
        String(inv.amount),
        inv.status.charAt(0).toUpperCase() + inv.status.slice(1),
      ]
    })
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'team_payouts_export.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const designers = localDesigners

  // ── Admin: Create Invoice modal ────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [createDesignerId, setCreateDesignerId] = useState(designers[0]?.id ?? '')
  const [createAmount, setCreateAmount] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createPeriodStart, setCreatePeriodStart] = useState(firstOfMonth())
  const [createPeriodEnd, setCreatePeriodEnd] = useState(lastOfMonth())
  const [createError, setCreateError] = useState<string | null>(null)

  function resetCreate() {
    setCreateDesignerId(designers[0]?.id ?? '')
    setCreateAmount('')
    setCreateDescription('')
    setCreatePeriodStart(firstOfMonth())
    setCreatePeriodEnd(lastOfMonth())
    setCreateError(null)
  }

  function handleCreate() {
    const amt = parseFloat(createAmount)
    if (!createDesignerId) { setCreateError('Select a designer.'); return }
    if (isNaN(amt) || amt <= 0) { setCreateError('Enter a valid amount.'); return }
    if (!createPeriodStart || !createPeriodEnd) { setCreateError('Enter a period.'); return }
    setCreateError(null)

    const designer = designers.find(d => d.id === createDesignerId)
    const invNum = `DES-${createPeriodStart.slice(0, 7).replace('-', '')}-${Date.now().toString().slice(-4)}`

    startTransition(async () => {
      const result = await createDesignerInvoice(
        createDesignerId, invNum, amt, createDescription || null, createPeriodStart, createPeriodEnd
      )
      if (result.error) { setCreateError(result.error); return }
      toast.success('Invoice created')
      setCreateOpen(false)
      resetCreate()
      setInvoices(prev => [{
        id: `new-${Date.now()}`,
        designer_id: createDesignerId,
        invoice_number: invNum,
        amount: amt,
        description: createDescription || null,
        attachment_path: null,
        status: 'pending',
        period_start: createPeriodStart,
        period_end: createPeriodEnd,
        paid_at: null,
        created_at: new Date().toISOString(),
      }, ...prev])
      void designer
    })
  }

  // ── Designer: Submit Invoice modal ─────────────────────────────────────────
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitAmount, setSubmitAmount] = useState('')
  const [submitDescription, setSubmitDescription] = useState('')
  const [submitPeriodStart, setSubmitPeriodStart] = useState(firstOfMonth())
  const [submitPeriodEnd, setSubmitPeriodEnd] = useState(lastOfMonth())
  const [submitFile, setSubmitFile] = useState<File | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function resetSubmit() {
    setSubmitAmount('')
    setSubmitDescription('')
    setSubmitPeriodStart(firstOfMonth())
    setSubmitPeriodEnd(lastOfMonth())
    setSubmitFile(null)
    setSubmitError(null)
    setUploadProgress(false)
  }

  async function handleSubmit() {
    const amt = parseFloat(submitAmount)
    if (isNaN(amt) || amt <= 0) { setSubmitError('Enter a valid amount.'); return }
    if (!submitDescription.trim()) { setSubmitError('Description is required.'); return }
    setSubmitError(null)

    let attachmentPath: string | null = null

    if (submitFile) {
      setUploadProgress(true)
      const supabase = createClient()
      const safeName = submitFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${currentUserId}/${Date.now()}-${safeName}`
      const { error: uploadErr } = await supabase.storage
        .from('designer-invoices')
        .upload(path, submitFile, { contentType: submitFile.type })
      setUploadProgress(false)
      if (uploadErr) { setSubmitError(`Upload failed: ${uploadErr.message}`); return }
      attachmentPath = path
    }

    const invNum = `INV-${submitPeriodStart.slice(0, 7).replace('-', '')}-${Date.now().toString().slice(-4)}`

    startTransition(async () => {
      const result = await submitDesignerInvoice(
        invNum, amt, submitDescription.trim(), submitPeriodStart, submitPeriodEnd, attachmentPath
      )
      if (result.error) { setSubmitError(result.error); return }
      toast.success('Invoice submitted for review')
      setSubmitOpen(false)
      resetSubmit()
      setInvoices(prev => [{
        id: `new-${Date.now()}`,
        invoice_number: invNum,
        amount: amt,
        description: submitDescription,
        attachment_path: attachmentPath,
        status: 'pending',
        period_start: submitPeriodStart,
        period_end: submitPeriodEnd,
        paid_at: null,
        created_at: new Date().toISOString(),
      }, ...prev])
    })
  }

  // ── Mark paid ──────────────────────────────────────────────────────────────
  function handleMarkPaid(invoiceId: string) {
    startTransition(async () => {
      try {
        await markDesignerInvoicePaid(invoiceId)
        setInvoices((prev) =>
          prev.map((inv) => inv.id === invoiceId ? { ...inv, status: 'paid', paid_at: new Date().toISOString() } : inv)
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
    <div className="animate-fade-in">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white tracking-tight">Payments</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isAdmin
              ? 'Manage designer payouts and invoices.'
              : `Your invoices and payment history, ${designerName}.`}
          </p>
        </div>
        {isAdmin ? (
          <Button onClick={() => { setCreateOpen(true); resetCreate() }} className="gap-1.5 shrink-0">
            <Plus size={14} strokeWidth={1.5} />
            Create Invoice
          </Button>
        ) : (
          <Button onClick={() => { setSubmitOpen(true); resetSubmit() }} className="gap-1.5 shrink-0">
            <Plus size={14} strokeWidth={1.5} />
            Submit Invoice
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl p-5">
          <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-3">Outstanding</p>
          <p className="text-2xl font-semibold text-black dark:text-white">{formatCurrency(totalPending)}</p>
          <p className="mt-1 text-xs text-zinc-400">{pending.length} invoice{pending.length !== 1 ? 's' : ''} pending</p>
        </div>
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl p-5">
          <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-3">Total Paid</p>
          <p className="text-2xl font-semibold text-black dark:text-white">
            {formatCurrency(paid.reduce((s, i) => s + i.amount, 0))}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{paid.length} invoice{paid.length !== 1 ? 's' : ''} paid</p>
        </div>
        {isAdmin && designers.length > 0 && (
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl p-5">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-3">Team Members</p>
            <p className="text-2xl font-semibold text-black dark:text-white">{designers.length}</p>
            <p className="mt-1 text-xs text-zinc-400">with retainer agreements</p>
          </div>
        )}
      </div>

      {/* Internal Team Retainers (admin only) */}
      {isAdmin && designers.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-black dark:text-white mb-3">Internal Team Retainers</h2>
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  <th className="px-5 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Team Member</th>
                  <th className="px-5 py-3 text-right text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Monthly Rate</th>
                </tr>
              </thead>
              <tbody>
                {designers.map((d) => (
                  <tr key={d.id} className="border-b border-zinc-50 dark:border-zinc-800 last:border-0">
                    <td className="px-5 py-3 font-medium text-black dark:text-white">{d.name}</td>
                    <td className="px-5 py-3 text-right">
                      {editingRetainer === d.id ? (
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          step="1"
                          value={retainerValue}
                          onChange={e => setRetainerValue(e.target.value)}
                          onBlur={() => saveRetainer(d.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveRetainer(d.id)
                            if (e.key === 'Escape') setEditingRetainer(null)
                          }}
                          disabled={savingRetainer}
                          className="w-28 h-7 px-2 text-sm text-right tabular-nums bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-400 disabled:opacity-50 transition-colors"
                        />
                      ) : (
                        <button
                          onClick={() => startEditRetainer(d)}
                          className="tabular-nums text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white transition-colors"
                          title="Click to edit"
                        >
                          {d.monthly_retainer != null
                            ? formatCurrency(d.monthly_retainer)
                            : <span className="text-zinc-300 dark:text-zinc-600 text-xs">Click to set</span>}
                        </button>
                      )}
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
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-black dark:text-white">All Invoices</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && designers.length > 0 && (
              <Select value={filterDesignerId} onValueChange={setFilterDesignerId}>
                <SelectTrigger className="h-8 w-auto text-xs rounded-lg min-w-[150px]">
                  <SelectValue placeholder="All Team Members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Members</SelectItem>
                  {designers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="h-8 px-2.5 text-xs bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-600 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="all">All Time</option>
              {availableMonths.map(ym => (
                <option key={ym} value={ym}>{formatMonth(ym)}</option>
              ))}
            </select>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
            >
              <Download size={12} strokeWidth={1.5} />
              Export
            </button>
          </div>
        </div>
        {displayedInvoices.length === 0 ? (
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center py-16 text-center">
            <Receipt size={28} strokeWidth={1} className="text-zinc-200 mb-3" />
            <p className="text-sm text-zinc-400">No invoices yet.</p>
            <p className="text-xs text-zinc-300 mt-1">
              {isAdmin ? 'Create an invoice using the button above.' : 'Submit an invoice to get paid.'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <th className="px-5 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Invoice</th>
                    {isAdmin && (
                      <th className="px-5 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden md:table-cell">Team Member</th>
                    )}
                    <th className="px-5 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden sm:table-cell">Period</th>
                    <th className="px-5 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden md:table-cell">Description</th>
                    <th className="px-5 py-3 text-right text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Amount</th>
                    <th className="px-5 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {displayedInvoices.map((inv) => {
                    const designer = isAdmin ? designers.find((d) => d.id === inv.designer_id) : null
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => setDetailInvoice(inv)}
                        className="border-b border-zinc-50 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5 font-medium text-black dark:text-white">{inv.invoice_number}</td>
                        {isAdmin && (
                          <td className="px-5 py-3.5 text-zinc-500 hidden md:table-cell">{designer?.name ?? '—'}</td>
                        )}
                        <td className="px-5 py-3.5 text-zinc-500 text-xs whitespace-nowrap hidden sm:table-cell">
                          {formatPeriod(inv.period_start, inv.period_end)}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-400 text-xs hidden md:table-cell max-w-[160px] truncate">
                          {inv.description || <span className="text-zinc-200">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium text-black dark:text-white tabular-nums">
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
                        <td className="px-4 py-3.5 text-right">
                          <ChevronRight size={14} strokeWidth={1.5} className="text-zinc-300 inline-block" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Invoice Detail Slide-over ──────────────────────────────────────── */}
      <Dialog open={detailInvoice !== null} onOpenChange={(o) => { if (!o) setDetailInvoice(null) }}>
        <DialogContent className="max-w-md">
          {detailInvoice && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">{detailInvoice.invoice_number}</DialogTitle>
                <DialogDescription>{formatPeriod(detailInvoice.period_start, detailInvoice.period_end)}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-1">
                {isAdmin && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 uppercase tracking-wide">Team Member</span>
                    <span className="text-sm font-medium text-black dark:text-white">
                      {designers.find((d) => d.id === detailInvoice.designer_id)?.name ?? '—'}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 uppercase tracking-wide">Amount</span>
                  <span className="text-xl font-semibold text-black dark:text-white tabular-nums">{formatCurrency(detailInvoice.amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 uppercase tracking-wide">Status</span>
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium border rounded-full',
                    detailInvoice.status === 'paid'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-amber-50 text-amber-700 border-amber-100'
                  )}>
                    {detailInvoice.status === 'paid' ? <CheckCircle2 size={10} strokeWidth={2} /> : <Clock size={10} strokeWidth={2} />}
                    {detailInvoice.status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </div>
                {detailInvoice.description && (
                  <div>
                    <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{detailInvoice.description}</p>
                  </div>
                )}
                {detailInvoice.paid_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 uppercase tracking-wide">Paid on</span>
                    <span className="text-sm text-black dark:text-white">
  {new Date(detailInvoice.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 uppercase tracking-wide">Submitted</span>
                  <span className="text-sm text-black dark:text-white">
                    {new Date(detailInvoice.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
              {isAdmin && detailInvoice.status === 'pending' && (
                <DialogFooter>
                  <Button
                    rounded="sm"
                    onClick={() => { handleMarkPaid(detailInvoice.id); setDetailInvoice(null) }}
                    disabled={isPending}
                    className="gap-1.5"
                  >
                    {isPending && <Loader2 size={13} className="animate-spin" />}
                    <CheckCircle2 size={13} strokeWidth={1.5} />
                    Mark as Paid
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Admin: Create Invoice dialog ───────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!isPending) { setCreateOpen(o); if (!o) resetCreate() } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Invoice for Team Member</DialogTitle>
            <DialogDescription>Log a payout for a specific team member and period.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />{createError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Team Member</Label>
              <Select value={createDesignerId} onValueChange={setCreateDesignerId}>
                <SelectTrigger className="rounded-lg dark:bg-zinc-900/50 dark:border-zinc-700 dark:text-white">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {designers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Amount (USD)</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                placeholder="e.g. 2500"
                value={createAmount}
                onChange={e => setCreateAmount(e.target.value)}
                disabled={isPending}
                className="dark:bg-zinc-900/50 dark:border-zinc-700 dark:text-white placeholder:dark:text-zinc-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Description (optional)</Label>
              <Input
                placeholder="e.g. March Retainer"
                value={createDescription}
                onChange={e => setCreateDescription(e.target.value)}
                disabled={isPending}
                className="dark:bg-zinc-900/50 dark:border-zinc-700 dark:text-white placeholder:dark:text-zinc-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Period Start</Label>
                <Input type="date" value={createPeriodStart} onChange={e => setCreatePeriodStart(e.target.value)} disabled={isPending} className="dark:bg-zinc-900/50 dark:border-zinc-700 dark:text-white dark:[color-scheme:dark]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Period End</Label>
                <Input type="date" value={createPeriodEnd} onChange={e => setCreatePeriodEnd(e.target.value)} disabled={isPending} className="dark:bg-zinc-900/50 dark:border-zinc-700 dark:text-white dark:[color-scheme:dark]" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" rounded="sm" onClick={() => setCreateOpen(false)} disabled={isPending}>Cancel</Button>
            <Button rounded="sm" onClick={handleCreate} disabled={isPending || !createAmount || !createDesignerId}>
              {isPending && <Loader2 size={13} className="animate-spin mr-1" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Designer: Submit Invoice dialog ───────────────────────────────── */}
      <Dialog open={submitOpen} onOpenChange={(o) => { if (!isPending && !uploadProgress) { setSubmitOpen(o); if (!o) resetSubmit() } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Invoice</DialogTitle>
            <DialogDescription>Submit your invoice to the admin for processing and payment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {submitError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />{submitError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Amount (USD)</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                placeholder="e.g. 2500"
                value={submitAmount}
                onChange={e => setSubmitAmount(e.target.value)}
                disabled={isPending || uploadProgress}
                className="dark:bg-zinc-900/50 dark:border-zinc-700 dark:text-white placeholder:dark:text-zinc-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Description</Label>
              <Input
                placeholder="e.g. March Retainer — Brand design"
                value={submitDescription}
                onChange={e => setSubmitDescription(e.target.value)}
                disabled={isPending || uploadProgress}
                className="dark:bg-zinc-900/50 dark:border-zinc-700 dark:text-white placeholder:dark:text-zinc-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Period Start</Label>
                <Input type="date" value={submitPeriodStart} onChange={e => setSubmitPeriodStart(e.target.value)} disabled={isPending || uploadProgress} className="dark:bg-zinc-900/50 dark:border-zinc-700 dark:text-white dark:[color-scheme:dark]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Period End</Label>
                <Input type="date" value={submitPeriodEnd} onChange={e => setSubmitPeriodEnd(e.target.value)} disabled={isPending || uploadProgress} className="dark:bg-zinc-900/50 dark:border-zinc-700 dark:text-white dark:[color-scheme:dark]" />
              </div>
            </div>

            {/* PDF upload */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Invoice PDF (optional)</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={e => setSubmitFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isPending || uploadProgress}
                className={cn(
                  'w-full h-20 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1.5 text-xs transition-colors',
                  submitFile
                    ? 'border-zinc-400 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                )}
              >
                {submitFile ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Upload size={14} strokeWidth={1.5} />
                      <span className="font-medium truncate max-w-[200px]">{submitFile.name}</span>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setSubmitFile(null); if (fileRef.current) fileRef.current.value = '' }}
                        className="text-zinc-400 hover:text-red-500"
                      >
                        <X size={12} strokeWidth={2} />
                      </button>
                    </div>
                    <span className="text-zinc-400">{(submitFile.size / 1024).toFixed(0)} KB</span>
                  </>
                ) : (
                  <>
                    <Upload size={16} strokeWidth={1.5} />
                    <span>Click to attach PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" rounded="sm" onClick={() => setSubmitOpen(false)} disabled={isPending || uploadProgress}>Cancel</Button>
            <Button rounded="sm" onClick={handleSubmit} disabled={isPending || uploadProgress || !submitAmount || !submitDescription.trim()}>
              {(isPending || uploadProgress) && <Loader2 size={13} className="animate-spin mr-1" />}
              {uploadProgress ? 'Uploading…' : 'Submit Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
