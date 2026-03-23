'use client'

import { useState, useEffect } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X, Plus, Trash2, CalendarIcon } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createInvoice, updateInvoice } from './invoice-actions'
import type { Invoice } from './InvoicesClient'

// ─── Types ────────────────────────────────────────────────────────────────────
interface LineItem {
  id: string
  description: string
  qty: string
  rate: string
}

interface CreateInvoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaces?: { id: string; name: string }[]
  editInvoice?: Invoice | null
  onCreated?: (invoice: Invoice) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toIso(d: Date) {
  return d.toISOString().slice(0, 10)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function genInvoiceNumber() {
  const n = Math.floor(Math.random() * 900) + 100
  return `INV-0${n}`
}

function newItem(): LineItem {
  return { id: crypto.randomUUID(), description: '', qty: '1', rate: '' }
}

const fmt = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── Shared input class ───────────────────────────────────────────────────────
const field =
  'w-full h-9 px-3 text-sm bg-white border border-zinc-200 rounded-lg ' +
  'text-zinc-900 placeholder:text-zinc-400 ' +
  'hover:border-zinc-300 ' +
  'focus-visible:outline-none focus-visible:border-zinc-300 focus-visible:shadow-[0_0_0_3px_rgba(0,0,0,0.04)] ' +
  'transition-colors duration-150'

// ─── DateButton ───────────────────────────────────────────────────────────────
function DateButton({
  value,
  placeholder,
  open,
  setOpen,
  onChange,
}: {
  value: string
  placeholder: string
  open: boolean
  setOpen: (v: boolean) => void
  onChange: (iso: string) => void
}) {
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(field, 'flex items-center gap-2 text-left cursor-pointer')}
        >
          <CalendarIcon size={13} strokeWidth={1.5} className="text-zinc-400 shrink-0" />
          <span className={value ? 'text-zinc-900' : 'text-zinc-400'}>
            {value ? formatDate(value) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-auto" style={{ zIndex: 9999 }}>
        <Calendar
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={d => { if (d) { onChange(toIso(d)); setOpen(false) } }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

// ─── CreateInvoiceModal ───────────────────────────────────────────────────────
export function CreateInvoiceModal({
  open,
  onOpenChange,
  workspaces = [],
  editInvoice,
  onCreated,
}: CreateInvoiceModalProps) {
  const isEdit = !!editInvoice

  const [workspaceId,    setWorkspaceId]    = useState('__none__')
  const [clientName,     setClientName]     = useState('')
  const [invoiceNumber,  setInvoiceNumber]  = useState(genInvoiceNumber)
  const [issueDate,      setIssueDate]      = useState<string>(toIso(new Date()))
  const [dueDate,        setDueDate]        = useState<string>('')
  const [issueDateOpen,  setIssueDateOpen]  = useState(false)
  const [dueDateOpen,    setDueDateOpen]    = useState(false)
  const [items,          setItems]          = useState<LineItem[]>([newItem()])
  const [notes,          setNotes]          = useState('')
  const [taxPct,         setTaxPct]         = useState('')
  const [saving,         setSaving]         = useState(false)

  // Populate fields when editing
  useEffect(() => {
    if (editInvoice?.rawData) {
      const r = editInvoice.rawData
      setWorkspaceId(r.workspace_id ?? '__none__')
      setClientName(r.client_name ?? '')
      setInvoiceNumber(r.invoice_number ?? genInvoiceNumber())
      setIssueDate(r.issue_date ?? toIso(new Date()))
      setDueDate(r.due_date ?? '')
      setNotes(r.notes ?? '')
      setTaxPct(r.tax_pct ? String(r.tax_pct) : '')
      const lineItems = Array.isArray(r.line_items) ? r.line_items : []
      setItems(lineItems.length
        ? lineItems.map((l: { description: string; qty: number; rate: number }) => ({
            id: crypto.randomUUID(),
            description: l.description,
            qty: String(l.qty),
            rate: String(l.rate),
          }))
        : [newItem()]
      )
    }
  }, [editInvoice])

  function reset() {
    setWorkspaceId('__none__')
    setClientName('')
    setInvoiceNumber(genInvoiceNumber())
    setIssueDate(toIso(new Date()))
    setDueDate('')
    setIssueDateOpen(false)
    setDueDateOpen(false)
    setItems([newItem()])
    setNotes('')
    setTaxPct('')
    setSaving(false)
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset()
    onOpenChange(v)
  }

  function addItem() {
    setItems(prev => [...prev, newItem()])
  }

  function removeItem(id: string) {
    if (items.length === 1) return
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function updateItem(id: string, f: keyof LineItem, value: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [f]: value } : i))
  }

  const subtotal = items.reduce((sum, item) => {
    return sum + (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0)
  }, 0)
  const taxAmount = subtotal * (parseFloat(taxPct) || 0) / 100
  const total     = subtotal + taxAmount

  // Resolve client name: prefer workspace name, fallback to manual entry
  const resolvedClientName =
    workspaceId !== '__none__'
      ? (workspaces.find(w => w.id === workspaceId)?.name ?? clientName)
      : clientName

  async function handleSubmit(status: 'draft' | 'pending') {
    setSaving(true)
    const lineItemsPayload = items
      .filter(i => i.description.trim())
      .map(i => ({ description: i.description, qty: parseFloat(i.qty) || 1, rate: parseFloat(i.rate) || 0 }))

    const payload = {
      workspace_id: workspaceId !== '__none__' ? workspaceId : null,
      invoice_number: invoiceNumber,
      status,
      client_name: resolvedClientName || null,
      issue_date: issueDate || null,
      due_date: dueDate || null,
      line_items: lineItemsPayload,
      notes: notes || null,
      tax_pct: parseFloat(taxPct) || 0,
      subtotal,
      total,
    }

    let result
    if (isEdit && editInvoice?.dbId) {
      result = await updateInvoice(editInvoice.dbId, payload)
    } else {
      result = await createInvoice(payload)
    }

    setSaving(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    const label = status === 'draft' ? 'Draft saved' : 'Invoice sent'
    toast.success(label, {
      description: resolvedClientName
        ? `${invoiceNumber} · ${resolvedClientName}`
        : invoiceNumber,
    })

    // Build a display invoice and propagate it up
    if (onCreated) {
      const amountStr = '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2 })
      const dbRow = (result as { data?: { id: string } }).data
      onCreated({
        id: invoiceNumber,
        dbId: dbRow?.id ?? editInvoice?.dbId,
        client: resolvedClientName || '—',
        project: '',
        amount: amountStr,
        issued: issueDate ? new Date(issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
        due: dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
        status,
        rawData: { ...payload, id: dbRow?.id ?? editInvoice?.dbId },
      })
    }

    handleOpenChange(false)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-overlay-show data-[state=closed]:animate-overlay-hide" />

        {/* Panel */}
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 left-1/2 top-1/2',
            'w-[95vw] max-w-5xl max-h-[90vh]',
            'bg-white rounded-2xl shadow-2xl shadow-black/15 flex flex-col overflow-hidden',
            'data-[state=open]:animate-dialog-show data-[state=closed]:animate-dialog-hide',
            'focus:outline-none',
          )}
          style={{ transform: 'translate(-50%, -50%)' }}
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-zinc-100 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-black">
                {isEdit ? 'Edit Invoice' : 'Create New Invoice'}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isEdit ? 'Update the invoice details below.' : 'Fill in the details below to draft or send.'}
              </p>
            </div>
            <DialogPrimitive.Close className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100 transition-all duration-150">
              <X size={15} strokeWidth={1.5} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-7">

              {/* ── Top meta: client + invoice details ──────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Client */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
                    Client / Workspace
                  </label>
                  {workspaces.length > 0 ? (
                    <Select value={workspaceId} onValueChange={setWorkspaceId}>
                      <SelectTrigger className="rounded-lg">
                        {workspaceId !== '__none__'
                          ? <span className="text-sm text-zinc-900">{workspaces.find(w => w.id === workspaceId)?.name}</span>
                          : <span className="text-sm text-zinc-400">Select a workspace…</span>
                        }
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces.map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <input
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      placeholder="Client name…"
                      className={field}
                    />
                  )}
                </div>

                {/* Invoice # + dates */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
                      Invoice #
                    </label>
                    <input
                      value={invoiceNumber}
                      onChange={e => setInvoiceNumber(e.target.value)}
                      className={field}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
                      Issue Date
                    </label>
                    <DateButton
                      value={issueDate}
                      placeholder="Pick…"
                      open={issueDateOpen}
                      setOpen={setIssueDateOpen}
                      onChange={setIssueDate}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
                      Due Date
                    </label>
                    <DateButton
                      value={dueDate}
                      placeholder="Pick…"
                      open={dueDateOpen}
                      setOpen={setDueDateOpen}
                      onChange={setDueDate}
                    />
                  </div>
                </div>
              </div>

              {/* ── Line items ──────────────────────────────────────────── */}
              <div>
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3">
                  Line Items
                </p>

                {/* Desktop table header */}
                <div className="hidden sm:grid grid-cols-[1fr_72px_96px_88px_32px] gap-x-2 px-3 py-1.5 bg-zinc-50 rounded-lg border border-zinc-100 mb-2">
                  <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Description</span>
                  <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest text-center">Qty</span>
                  <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Rate ($)</span>
                  <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest text-right">Amount</span>
                  <span />
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0)

                    return (
                      <div key={item.id}>
                        {/* Mobile layout */}
                        <div className="sm:hidden bg-zinc-50/60 border border-zinc-100 rounded-lg p-3 space-y-2">
                          <input
                            value={item.description}
                            onChange={e => updateItem(item.id, 'description', e.target.value)}
                            placeholder={`Item ${idx + 1} — description`}
                            className={field}
                          />
                          <div className="flex items-center gap-2">
                            <input
                              value={item.qty}
                              onChange={e => updateItem(item.id, 'qty', e.target.value)}
                              type="number" min="0" step="1"
                              placeholder="Qty"
                              className={cn(field, 'w-16 text-center')}
                            />
                            <span className="text-xs text-zinc-400 shrink-0">×</span>
                            <input
                              value={item.rate}
                              onChange={e => updateItem(item.id, 'rate', e.target.value)}
                              type="number" min="0" step="0.01"
                              placeholder="0.00"
                              className={cn(field, 'flex-1')}
                            />
                            <span className="text-sm font-medium text-zinc-900 tabular-nums w-20 text-right shrink-0">
                              {amount > 0 ? fmt(amount) : <span className="text-zinc-300">—</span>}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              disabled={items.length === 1}
                              className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={13} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>

                        {/* Desktop layout */}
                        <div className="hidden sm:grid grid-cols-[1fr_72px_96px_88px_32px] gap-x-2 items-center">
                          <input
                            value={item.description}
                            onChange={e => updateItem(item.id, 'description', e.target.value)}
                            placeholder={`Item ${idx + 1}`}
                            className={field}
                          />
                          <input
                            value={item.qty}
                            onChange={e => updateItem(item.id, 'qty', e.target.value)}
                            type="number" min="0" step="1"
                            className={cn(field, 'text-center')}
                          />
                          <input
                            value={item.rate}
                            onChange={e => updateItem(item.id, 'rate', e.target.value)}
                            type="number" min="0" step="0.01"
                            placeholder="0.00"
                            className={field}
                          />
                          <span className="text-sm font-medium text-zinc-900 tabular-nums text-right">
                            {amount > 0 ? fmt(amount) : <span className="text-zinc-300">—</span>}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            disabled={items.length === 1}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={13} strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-black transition-colors duration-150"
                >
                  <Plus size={12} strokeWidth={1.5} />
                  Add line item
                </button>
              </div>

              {/* ── Notes + Totals ──────────────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-zinc-100">

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
                    Notes / Terms
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={5}
                    placeholder="Payment terms, bank details, or any notes for your client…"
                    className={cn(
                      'w-full px-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg',
                      'text-zinc-900 placeholder:text-zinc-400 resize-none',
                      'hover:border-zinc-300',
                      'focus-visible:outline-none focus-visible:border-zinc-300 focus-visible:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]',
                      'transition-colors duration-150',
                    )}
                  />
                </div>

                {/* Totals */}
                <div className="flex flex-col justify-end">
                  <div className="bg-zinc-50 rounded-xl border border-zinc-100 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">Subtotal</span>
                      <span className="text-sm font-medium text-zinc-900 tabular-nums">{fmt(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-zinc-500 shrink-0">Tax (%)</span>
                      <input
                        value={taxPct}
                        onChange={e => setTaxPct(e.target.value)}
                        type="number" min="0" max="100" step="0.1"
                        placeholder="0"
                        className={cn(
                          'w-24 h-8 px-2.5 text-sm text-right bg-white border border-zinc-200 rounded-lg',
                          'focus-visible:outline-none focus-visible:border-zinc-300 focus-visible:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]',
                          'transition-colors duration-150',
                        )}
                      />
                    </div>
                    <div className="h-px bg-zinc-200" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-black">Total</span>
                      <span className="text-xl font-semibold text-black tabular-nums">{fmt(total)}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 shrink-0 bg-white">
            <DialogPrimitive.Close
              disabled={saving}
              className="h-9 px-4 text-sm text-zinc-500 hover:text-black transition-colors duration-150 rounded-lg hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </DialogPrimitive.Close>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSubmit('draft')}
                className="h-9 px-4 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 hover:bg-zinc-50 transition-colors duration-150 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSubmit('pending')}
                className="h-9 px-5 text-sm font-medium text-white bg-black rounded-lg hover:bg-zinc-800 active:bg-zinc-900 transition-colors duration-150 disabled:opacity-50"
              >
                {saving ? 'Sending…' : (isEdit ? 'Update Invoice' : 'Send Invoice')}
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
