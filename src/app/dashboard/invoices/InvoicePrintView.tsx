'use client'

import React from 'react'
import type { Invoice } from './InvoicesClient'

interface LineItem {
  description: string
  qty: number
  rate: number
}

interface InvoicePrintViewProps {
  invoice: Invoice
  lines: LineItem[]
  subtotal: number
  taxPct?: number
  notes?: string
}

const fmt = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * A4-sized invoice layout rendered off-screen for html2canvas capture.
 * Fixed width of 794px (96dpi A4) so jsPDF fills the page perfectly.
 */
export const InvoicePrintView = React.forwardRef<HTMLDivElement, InvoicePrintViewProps>(
  ({ invoice, lines, subtotal, taxPct = 0, notes }, ref) => {
    const taxAmount = subtotal * taxPct / 100
    const total = subtotal + taxAmount

    return (
      <div
        ref={ref}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '794px',
          minHeight: '1123px',
          backgroundColor: '#ffffff',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
          color: '#09090b',
          padding: '60px 64px',
          boxSizing: 'border-box',
        }}
      >
        {/* ── Header row ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '48px' }}>
          {/* Logo / brand */}
          <div>
            <div style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px', color: '#09090b' }}>
              Clikaa
            </div>
            <div style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '2px', letterSpacing: '0.5px' }}>
              Creative Studio
            </div>
          </div>

          {/* INVOICE label + number */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px', color: '#09090b' }}>
              INVOICE
            </div>
            <div style={{ fontSize: '13px', color: '#71717a', marginTop: '4px', fontFamily: 'monospace' }}>
              {invoice.id}
            </div>
          </div>
        </div>

        {/* ── Meta block ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '48px' }}>
          {/* Bill To */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: '600', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Bill To
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#09090b' }}>{invoice.client}</div>
            {invoice.project && (
              <div style={{ fontSize: '13px', color: '#71717a', marginTop: '2px' }}>{invoice.project}</div>
            )}
          </div>

          {/* Dates + Status */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: '#a1a1aa', marginRight: '12px' }}>Issue Date</span>
              <span style={{ fontSize: '13px', color: '#09090b' }}>{invoice.issued}</span>
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: '#a1a1aa', marginRight: '12px' }}>Due Date</span>
              <span style={{
                fontSize: '13px',
                fontWeight: '500',
                color: invoice.status === 'overdue' ? '#dc2626' : '#09090b',
              }}>
                {invoice.due}
              </span>
            </div>
            <div style={{ marginTop: '10px' }}>
              <span style={{
                display: 'inline-block',
                padding: '3px 10px',
                fontSize: '11px',
                fontWeight: '600',
                borderRadius: '20px',
                ...(invoice.status === 'paid'
                  ? { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }
                  : invoice.status === 'overdue'
                  ? { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }
                  : { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }
                ),
              }}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────── */}
        <div style={{ height: '1px', background: '#f4f4f5', marginBottom: '28px' }} />

        {/* ── Line items table ────────────────────────────────────── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: '1px solid #f4f4f5' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '600', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Description
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10px', fontWeight: '600', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.8px', width: '60px' }}>
                Qty
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10px', fontWeight: '600', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.8px', width: '100px' }}>
                Rate
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10px', fontWeight: '600', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.8px', width: '110px' }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f4f4f5' }}>
                <td style={{ padding: '12px 12px', fontSize: '13px', color: '#09090b' }}>
                  {line.description}
                </td>
                <td style={{ padding: '12px 12px', textAlign: 'center', fontSize: '13px', color: '#71717a' }}>
                  {line.qty}
                </td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: '13px', color: '#71717a', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(line.rate)}
                </td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: '13px', fontWeight: '500', color: '#09090b', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(line.qty * line.rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Totals ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
          <div style={{ width: '260px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
              <span style={{ color: '#71717a' }}>Subtotal</span>
              <span style={{ color: '#09090b', fontVariantNumeric: 'tabular-nums' }}>{fmt(subtotal)}</span>
            </div>
            {taxPct > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                <span style={{ color: '#71717a' }}>Tax ({taxPct}%)</span>
                <span style={{ color: '#09090b', fontVariantNumeric: 'tabular-nums' }}>{fmt(taxAmount)}</span>
              </div>
            )}
            <div style={{ height: '1px', background: '#e4e4e7', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ fontSize: '15px', fontWeight: '600', color: '#09090b' }}>Total</span>
              <span style={{ fontSize: '18px', fontWeight: '700', color: '#09090b', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(total)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Notes ───────────────────────────────────────────────── */}
        {notes && (
          <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #f4f4f5' }}>
            <div style={{ fontSize: '10px', fontWeight: '600', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Notes
            </div>
            <div style={{ fontSize: '13px', color: '#71717a', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {notes}
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div style={{ position: 'absolute', bottom: '40px', left: '64px', right: '64px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '11px', color: '#d4d4d8' }}>Thank you for your business.</div>
          <div style={{ fontSize: '11px', color: '#d4d4d8', fontFamily: 'monospace' }}>{invoice.id}</div>
        </div>
      </div>
    )
  }
)

InvoicePrintView.displayName = 'InvoicePrintView'
