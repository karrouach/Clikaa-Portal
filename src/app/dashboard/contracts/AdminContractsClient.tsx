'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Loader2, Send, FileText, BookTemplate, AlertCircle, Check, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ContractViewModal } from './ContractViewModal'
import {
  createContract, deleteContract, sendContractForSignature,
  createTemplate, deleteTemplate,
} from './contract-actions'
import type { Contract, ContractTemplate } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Workspace { id: string; name: string }

interface Props {
  initialContracts: Contract[]
  initialTemplates: ContractTemplate[]
  workspaces: Workspace[]
}

// ─── Status styles ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<Contract['status'], string> = {
  draft:             'bg-zinc-100 text-zinc-600 border-zinc-200',
  pending_signature: 'bg-amber-50 text-amber-700 border-amber-100',
  signed:            'bg-emerald-50 text-emerald-700 border-emerald-100',
}
const STATUS_LABELS: Record<Contract['status'], string> = {
  draft:             'Draft',
  pending_signature: 'Pending Signature',
  signed:            'Signed',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminContractsClient({ initialContracts, initialTemplates, workspaces }: Props) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [templates, setTemplates] = useState<ContractTemplate[]>(initialTemplates)
  const [activeTab, setActiveTab] = useState<'contracts' | 'templates'>('contracts')

  const [viewContract, setViewContract] = useState<Contract | null>(null)
  const [isPending, startTransition] = useTransition()

  // ── Create contract dialog ─────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [contractTitle, setContractTitle] = useState('')
  const [contractBody, setContractBody] = useState('')
  const [contractWorkspace, setContractWorkspace] = useState(workspaces[0]?.id ?? '')
  const [contractTemplate, setContractTemplate] = useState<string>('__none__')
  const [createError, setCreateError] = useState<string | null>(null)

  function resetCreate() {
    setContractTitle(''); setContractBody(''); setContractWorkspace(workspaces[0]?.id ?? '')
    setContractTemplate('__none__'); setCreateError(null)
  }

  function handleTemplateSelect(templateId: string) {
    setContractTemplate(templateId)
    if (templateId !== '__none__') {
      const tpl = templates.find(t => t.id === templateId)
      if (tpl) setContractBody(tpl.body_text)
    }
  }

  function handleCreate(sendNow: boolean) {
    if (!contractTitle.trim()) { setCreateError('Title is required.'); return }
    if (!contractWorkspace) { setCreateError('Select a workspace.'); return }
    setCreateError(null)
    startTransition(async () => {
      const result = await createContract({
        workspaceId: contractWorkspace,
        templateId: contractTemplate === '__none__' ? null : contractTemplate,
        title: contractTitle.trim(),
        bodyText: contractBody,
        sendNow,
      })
      if (result.error) { setCreateError(result.error); return }
      toast.success(sendNow ? 'Contract sent for signature' : 'Contract saved as draft')
      setCreateOpen(false)
      resetCreate()
      // Re-fetch would be ideal; for now we optimistically add a placeholder
      // The page will revalidate server-side via revalidatePath
      setTimeout(() => window.location.reload(), 300)
    })
  }

  function handleSend(contract: Contract) {
    startTransition(async () => {
      const result = await sendContractForSignature(contract.id)
      if (result.error) { toast.error(result.error); return }
      toast.success('Sent for signature')
      setContracts(prev => prev.map(c => c.id === contract.id ? { ...c, status: 'pending_signature' } : c))
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this contract? This cannot be undone.')) return
    startTransition(async () => {
      const result = await deleteContract(id)
      if (result.error) { toast.error(result.error); return }
      setContracts(prev => prev.filter(c => c.id !== id))
    })
  }

  // ── Create template dialog ─────────────────────────────────────────────────
  const [tplOpen, setTplOpen] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplBody, setTplBody] = useState('')
  const [tplError, setTplError] = useState<string | null>(null)
  const [tplSuccess, setTplSuccess] = useState(false)

  function resetTpl() { setTplName(''); setTplBody(''); setTplError(null); setTplSuccess(false) }

  function handleCreateTemplate() {
    if (!tplName.trim()) { setTplError('Template name is required.'); return }
    setTplError(null)
    startTransition(async () => {
      const result = await createTemplate(tplName.trim(), tplBody)
      if (result.error) { setTplError(result.error); return }
      setTplSuccess(true)
      setTimeout(() => { setTplOpen(false); resetTpl(); window.location.reload() }, 1200)
    })
  }

  function handleDeleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return
    startTransition(async () => {
      const result = await deleteTemplate(id)
      if (result.error) { toast.error(result.error); return }
      setTemplates(prev => prev.filter(t => t.id !== id))
    })
  }

  const tabs = [
    { key: 'contracts' as const, label: 'Contracts', count: contracts.length },
    { key: 'templates' as const, label: 'Templates', count: templates.length },
  ]

  const workspaceMap = Object.fromEntries(workspaces.map(w => [w.id, w.name]))

  return (
    <div className="animate-fade-in">
      {/* ── Page heading ─────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-black tracking-tight">Contracts</h1>
          <p className="mt-1 text-sm text-zinc-500">Manage client agreements and templates.</p>
        </div>
        {activeTab === 'contracts' && (
          <Button size="sm" rounded="sm" onClick={() => { setCreateOpen(true); resetCreate() }} className="gap-1.5 text-xs shrink-0">
            <Plus size={13} strokeWidth={1.5} />
            Create Contract
          </Button>
        )}
        {activeTab === 'templates' && (
          <Button size="sm" rounded="sm" onClick={() => { setTplOpen(true); resetTpl() }} className="gap-1.5 text-xs shrink-0">
            <Plus size={13} strokeWidth={1.5} />
            New Template
          </Button>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 mb-6 border-b border-zinc-100">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'relative px-4 pb-3 pt-1 text-sm font-medium transition-colors duration-150',
              activeTab === key
                ? 'text-black after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-black'
                : 'text-zinc-400 hover:text-zinc-600'
            )}
          >
            {label}
            <span className={cn('ml-1.5 text-[10px] tabular-nums px-1.5 py-0.5 rounded-full', activeTab === key ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500')}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Contracts tab ────────────────────────────────────────────────── */}
      {activeTab === 'contracts' && (
        <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
          {contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <FileText size={28} strokeWidth={1} className="text-zinc-300 mb-1" />
              <p className="text-sm font-medium text-zinc-900">No contracts yet</p>
              <p className="text-sm text-zinc-400">Create your first contract using the button above.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Title</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden md:table-cell">Workspace</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden lg:table-cell">Date</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <button
                        onClick={() => setViewContract(c)}
                        className="font-medium text-black hover:underline underline-offset-2 text-left"
                      >
                        {c.title}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 hidden md:table-cell">
                      {c.workspace_id ? (workspaceMap[c.workspace_id] ?? '—') : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn('inline-flex items-center px-2 py-0.5 text-[10px] font-medium border rounded-full', STATUS_STYLES[c.status])}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400 text-xs hidden lg:table-cell whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {c.status === 'draft' && (
                          <button
                            onClick={() => handleSend(c)}
                            disabled={isPending}
                            className="flex items-center gap-1 h-7 px-2.5 text-xs text-zinc-600 hover:text-black hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-40"
                            title="Send for signature"
                          >
                            <Send size={12} strokeWidth={1.5} />
                            <span className="hidden sm:block">Send</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={isPending}
                          className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                          title="Delete"
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Templates tab ────────────────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <BookTemplate size={28} strokeWidth={1} className="text-zinc-300 mb-1" />
              <p className="text-sm font-medium text-zinc-900">No templates yet</p>
              <p className="text-sm text-zinc-400">Create reusable contract templates to speed up your workflow.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-6 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Template Name</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-zinc-400 uppercase tracking-widest hidden md:table-cell">Preview</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-black">{t.template_name}</td>
                    <td className="px-4 py-3.5 text-zinc-400 text-xs hidden md:table-cell max-w-sm truncate">
                      {t.body_text.replace(/[#*\n]/g, ' ').trim().slice(0, 100)}…
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        disabled={isPending}
                        className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                      >
                        <Trash2 size={13} strokeWidth={1.5} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Create contract dialog ────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!isPending) { setCreateOpen(o); if (!o) resetCreate() } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Contract</DialogTitle>
            <DialogDescription>Fill in the details, then save as draft or send immediately for signature.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2 max-h-[65vh] overflow-y-auto pr-1">
            {createError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />{createError}
              </div>
            )}
            {/* Template selector */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600">Template (optional)</Label>
              <Select value={contractTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Start from scratch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Start from scratch</SelectItem>
                  {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Workspace */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600">Client Workspace</Label>
              <Select value={contractWorkspace} onValueChange={setContractWorkspace}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600">Contract Title</Label>
              <Input placeholder="e.g. Master Services Agreement — Acme Corp" value={contractTitle} onChange={e => setContractTitle(e.target.value)} disabled={isPending} />
            </div>
            {/* Body */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-zinc-600">Contract Terms (Markdown supported)</Label>
              <Textarea
                placeholder="# Agreement&#10;&#10;Enter contract terms here…"
                value={contractBody}
                onChange={e => setContractBody(e.target.value)}
                disabled={isPending}
                className="min-h-[240px] font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" rounded="sm" onClick={() => setCreateOpen(false)} disabled={isPending}>Cancel</Button>
            <Button variant="outline" rounded="sm" onClick={() => handleCreate(false)} disabled={isPending || !contractTitle.trim()}>
              {isPending ? <Loader2 size={13} className="animate-spin" /> : null}
              Save as Draft
            </Button>
            <Button rounded="sm" onClick={() => handleCreate(true)} disabled={isPending || !contractTitle.trim()} className="gap-1.5">
              <Send size={13} strokeWidth={1.5} />
              Send for Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create template dialog ────────────────────────────────────────── */}
      <Dialog open={tplOpen} onOpenChange={(o) => { if (!isPending) { setTplOpen(o); if (!o) resetTpl() } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Template</DialogTitle>
            <DialogDescription>Save a reusable contract template to pre-fill future contracts.</DialogDescription>
          </DialogHeader>
          {tplSuccess ? (
            <div className="py-8 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <Check size={18} strokeWidth={2} className="text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-emerald-600">Template saved!</p>
            </div>
          ) : (
            <div className="space-y-5 py-2 max-h-[65vh] overflow-y-auto pr-1">
              {tplError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                  <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />{tplError}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-zinc-600">Template Name</Label>
                <Input placeholder="e.g. Standard MSA" value={tplName} onChange={e => setTplName(e.target.value)} disabled={isPending} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-zinc-600">Body Text (Markdown supported)</Label>
                <Textarea
                  placeholder="# Agreement&#10;&#10;Enter template body…"
                  value={tplBody}
                  onChange={e => setTplBody(e.target.value)}
                  disabled={isPending}
                  className="min-h-[240px] font-mono text-xs"
                />
              </div>
            </div>
          )}
          {!tplSuccess && (
            <DialogFooter>
              <Button variant="outline" rounded="sm" onClick={() => setTplOpen(false)} disabled={isPending}>Cancel</Button>
              <Button rounded="sm" onClick={handleCreateTemplate} disabled={isPending || !tplName.trim()}>
                {isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
                Save Template
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Contract view (admin read-only) ──────────────────────────────── */}
      <ContractViewModal
        contract={viewContract}
        onClose={() => setViewContract(null)}
        isAdminView
      />
    </div>
  )
}
