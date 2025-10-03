import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { formatCurrency } from '../../lib/format'
import {
  listBillingHistory,
  type BillingHistoryEntry,
  type BillingHistoryLine,
} from '../../services/inventoryItems'
import { Loader2, RefreshCcw, ArrowDownToLine, X } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface BillingHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const statusStyles: Record<string, string> = {
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
}

const statusLabels: Record<string, string> = {
  paid: 'Paid',
  pending: 'Credit / Pending',
  failed: 'Failed',
}

const paymentLabels: Record<string, string> = {
  cash: 'Cash',
  online: 'Online',
  cheque: 'Cheque',
  credit: 'Credit',
}

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'invoice'

const buildDownloadTitle = (entry: BillingHistoryEntry) => {
  const base = entry.partyName ? `${entry.partyName}-${entry.invoiceNo}` : entry.invoiceNo
  return slugify(base)
}

const downloadInvoice = (entry: BillingHistoryEntry) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const date = new Date(entry.invoiceDate)
  const friendlyDate = Number.isNaN(date.getTime())
    ? entry.invoiceDate
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  const title = entry.partyName || 'Walk-in customer'

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('Sales Invoice', 40, 60)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(80)
  doc.text(`Invoice #: ${entry.invoiceNo}`, 40, 82)
  doc.text(`Date: ${friendlyDate}`, 40, 100)
  doc.text(`Customer: ${title}`, 40, 118)
  doc.text(`Total amount: ${formatCurrency(entry.totalAmount)}`, 40, 136)
  doc.text(`Payment method: ${paymentLabels[entry.paymentMethod] ?? entry.paymentMethod}`, 40, 154)

  autoTable(doc, {
    startY: 178,
    head: [['Item', 'Quantity', 'Price', 'Line total']],
    body: entry.items.map((line: BillingHistoryLine) => [
      line.name,
      `${line.quantity} ${line.unit ?? ''}`.trim(),
      formatCurrency(line.price),
      formatCurrency(line.amount),
    ]),
    styles: { fontSize: 10, cellPadding: 6, textColor: [44, 62, 80] },
    headStyles: { fillColor: [76, 92, 205], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    alternateRowStyles: { fillColor: [245, 247, 255] },
  })

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40)
  const summaryY = (doc as any).lastAutoTable?.finalY ?? 178
  doc.text(`Grand total: ${formatCurrency(entry.totalAmount)}`, 40, summaryY + 32)

  doc.save(`${buildDownloadTitle(entry)}.pdf`)
}

export default function BillingHistoryDialog({ open, onOpenChange }: BillingHistoryDialogProps) {
  const [entries, setEntries] = useState<BillingHistoryEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const fetchHistory = useCallback(
    async (term?: string) => {
      if (!open) return
      setLoading(true)
      setError(null)
      try {
        const { rows, total } = await listBillingHistory({ search: term, page: 1, limit: 20 })
        setEntries(rows)
        setTotal(total)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load billing history'
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [open]
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!open) return
    fetchHistory(debouncedSearch ? debouncedSearch : undefined)
  }, [open, debouncedSearch, fetchHistory])

  useEffect(() => {
    if (!open) {
      setSearch('')
      setError(null)
      return
    }
  }, [open])

  const statusSummary = useMemo(() => {
    const paid = entries.filter((entry) => entry.status === 'paid').length
    return paid
  }, [entries])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[70]" />
        <DialogContent className="fixed z-[80] top-1/2 left-1/2 w-[95vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-900">Billing history</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Review invoices saved from your sales. {statusSummary ? `${statusSummary} marked as paid.` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-slate-900"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search invoices or parties"
                  className="w-64"
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fetchHistory(debouncedSearch ? debouncedSearch : undefined)}
                  disabled={loading}
                  className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                >
                  <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                {total ? `${total} total invoice${total === 1 ? '' : 's'}` : 'No invoices yet'}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Invoice</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Billing date</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Payment</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-muted-foreground" colSpan={6}>
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading history...
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loading && error && (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-red-600" colSpan={6}>
                        {error}
                      </td>
                    </tr>
                  )}
                  {!loading && !error && entries.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-muted-foreground" colSpan={6}>
                        No billing history found yet.
                      </td>
                    </tr>
                  )}
                  {!loading && !error &&
                    entries.map((entry) => {
                      const statusKey = (entry.status || 'pending').toLowerCase()
                      const statusLabel = statusLabels[statusKey] ?? statusKey.charAt(0).toUpperCase() + statusKey.slice(1)
                      const statusClass = statusStyles[statusKey] ?? 'border-slate-200 bg-slate-50 text-slate-700'
                      const paymentLabel = paymentLabels[entry.paymentMethod] ?? entry.paymentMethod
                      return (
                        <tr key={entry.id} className="border-t">
                          <td className="px-4 py-3 align-top">
                            <div className="font-semibold text-slate-900">{entry.invoiceNo}</div>
                            {entry.partyName && <div className="text-xs text-muted-foreground">{entry.partyName}</div>}
                          </td>
                          <td className="px-4 py-3 align-top text-slate-700">{formatDate(entry.invoiceDate)}</td>
                          <td className="px-4 py-3 align-top">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top text-right font-semibold text-slate-900">
                            {formatCurrency(entry.totalAmount)}
                          </td>
                          <td className="px-4 py-3 align-top capitalize text-slate-700">{paymentLabel}</td>
                          <td className="px-4 py-3 align-top text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadInvoice(entry)}
                              className="text-indigo-600 hover:text-indigo-700"
                            >
                              <ArrowDownToLine className="mr-2 h-4 w-4" /> Download
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
