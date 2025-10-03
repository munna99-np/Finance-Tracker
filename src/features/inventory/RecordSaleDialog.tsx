import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { formatCurrency } from '../../lib/format'
import {
  recordSale,
  searchItems,
  addBillingHistoryEntry,
  type SaleLineInput,
  type SalePaymentMethod,
  type BillingStatus,
  type BillingHistoryLineInput,
} from '../../services/inventoryItems'
import { usePartySearch } from '../../hooks/useInventory'
import { toast } from 'sonner'
import { FileText, Loader2, Search, Trash2, UserRound, X, Check, History } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface RecordSaleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaleComplete?: () => void
}

type SaleCandidate = {
  id: string
  name: string
  sku: string | null
  unit: string | null
  price: number
  stock: number
}

type SaleLine = SaleCandidate & { quantity: number }

type PartyOption = {
  id?: string
  name: string
}

const formatQty = (value: number) => {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const invoiceNumber = () => `INV-${Date.now()}`

const formatDateTime = (value: Date) => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(value)
  } catch {
    return value.toISOString()
  }
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'invoice'

export default function RecordSaleDialog({ open, onOpenChange, onSaleComplete }: RecordSaleDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState<SaleCandidate[]>([])
  const [fetchingItems, setFetchingItems] = useState(false)
  const [lines, setLines] = useState<SaleLine[]>([])
  const [saving, setSaving] = useState(false)

  const [partyQuery, setPartyQuery] = useState('')
  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null)
  const [showPartySuggestions, setShowPartySuggestions] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('cash')
  const [billingStatus, setBillingStatus] = useState<BillingStatus>('paid')
  const [invoiceNo, setInvoiceNo] = useState(() => invoiceNumber())
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null)

  const { data: partyMatches } = usePartySearch(partyQuery)

  useEffect(() => {
    if (open) {
      setInvoiceNo(invoiceNumber())
      setPaymentMethod('cash')
      setBillingStatus('paid')
      setSavedInvoiceId(null)
      setSavingInvoice(false)
      return
    }
    setSearchTerm('')
    setSuggestions([])
    setLines([])
    setFetchingItems(false)
    setSaving(false)
    setPartyQuery('')
    setSelectedParty(null)
    setShowPartySuggestions(false)
    setSavingInvoice(false)
    setSavedInvoiceId(null)
  }, [open])

  useEffect(() => {
    if (!savedInvoiceId) return
    setSavedInvoiceId(null)
  }, [lines])

  useEffect(() => {
    if (!savedInvoiceId) return
    setSavedInvoiceId(null)
  }, [paymentMethod])

  useEffect(() => {
    if (!open) return
    const keyword = searchTerm.trim()
    if (!keyword) {
      setSuggestions([])
      setFetchingItems(false)
      return
    }
    setFetchingItems(true)
    let active = true
    const handle = setTimeout(async () => {
      try {
        const rows = await searchItems(keyword, { inStockOnly: true, limit: 12 })
        if (!active) return
        const mapped = rows.map((row: any) => ({
          id: row.id,
          name: row.name,
          sku: row.sku ?? null,
          unit: row.unit ?? null,
          price: Number(row.price ?? 0),
          stock: Number(row.stock ?? 0),
        }))
        setSuggestions(mapped.filter((item) => item.stock > 0))
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : 'Failed to search items'
        toast.error(message)
      } finally {
        if (active) setFetchingItems(false)
      }
    }, 250)
    return () => {
      active = false
      clearTimeout(handle)
    }
  }, [open, searchTerm])

  const addCandidate = (candidate: SaleCandidate) => {
    setLines((prev) => {
      const existing = prev.find((line) => line.id === candidate.id)
      if (existing) {
        return prev.map((line) =>
          line.id === candidate.id
            ? { ...line, quantity: Math.min(line.stock, Number((line.quantity + 1).toFixed(2))) }
            : line
        )
      }
      return [
        ...prev,
        {
          ...candidate,
          quantity: Math.min(candidate.stock, 1),
        },
      ]
    })
    setSearchTerm('')
    setSuggestions([])
  }

  const removeLine = (itemId: string) => {
    setLines((prev) => prev.filter((line) => line.id !== itemId))
  }

  const updateQuantity = (itemId: string, value: string) => {
    const quantity = Number(value)
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== itemId) return line
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return { ...line, quantity: 0 }
        }
        const capped = Math.min(line.stock, quantity)
        return { ...line, quantity: Number(capped.toFixed(2)) }
      })
    )
  }

  const updatePrice = (itemId: string, value: string) => {
    const price = Number(value)
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== itemId) return line
        if (!Number.isFinite(price) || price < 0) {
          return { ...line, price: 0 }
        }
        return { ...line, price: Number(price.toFixed(2)) }
      })
    )
  }

  const totalAmount = useMemo(() => {
    return lines.reduce((sum, line) => sum + line.quantity * line.price, 0)
  }, [lines])

  const hasInvalidLine = lines.some((line) => line.quantity <= 0 || line.quantity > line.stock)
  const canSubmit = lines.length > 0 && !hasInvalidLine && !saving

  const partySuggestions = useMemo(() => {
    if (!partyMatches) return []
    if (!partyQuery.trim()) return partyMatches.slice(0, 8)
    return partyMatches
  }, [partyMatches, partyQuery])

  const selectedPartyName = selectedParty?.name || partyQuery.trim()
  const billingStatusLabelMap: Record<BillingStatus, string> = {
    paid: 'Paid',
    pending: 'Credit / Pending',
    failed: 'Failed',
  }
  const billingStatusBadgeMap: Record<BillingStatus, string> = {
    paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    failed: 'border-red-200 bg-red-50 text-red-700',
  }
  const billingButtonPalette: Record<BillingStatus, string> = {
    paid: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700',
    pending: 'border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700',
    failed: 'border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700',
  }
  const billingStatusLabel = billingStatusLabelMap[billingStatus]
  const billingStatusClass = billingStatusBadgeMap[billingStatus]
  const billingButtonLabel = savedInvoiceId ? 'Update billing history' : 'Add billing history'
  const billingButtonClasses = billingButtonPalette[billingStatus]

  const handleGenerateInvoice = () => {
    if (lines.length === 0 || hasInvalidLine) {
      toast.error('Add valid items before generating an invoice')
      return
    }
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const now = new Date()
    const title = selectedPartyName || 'Walk-in customer'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text('Sales Invoice', 40, 60)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(80)
    doc.text(`Invoice #: ${invoiceNo}`, 40, 82)
    doc.text(`Date: ${formatDateTime(now)}`, 40, 100)
    doc.text(`Customer: ${title || 'Walk-in customer'}`, 40, 118)
    doc.text(`Total amount: ${formatCurrency(totalAmount)}`, 40, 136)

    autoTable(doc, {
      startY: 160,
      head: [['Item', 'Quantity', 'Price', 'Line total']],
      body: lines.map((line) => [
        line.name,
        `${formatQty(line.quantity)} ${line.unit ?? ''}`.trim(),
        formatCurrency(line.price),
        formatCurrency(line.quantity * line.price),
      ]),
      styles: { fontSize: 10, cellPadding: 6, textColor: [44, 62, 80] },
      headStyles: { fillColor: [76, 92, 205], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      alternateRowStyles: { fillColor: [245, 247, 255] },
    })

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40)
    const summaryY = (doc as any).lastAutoTable?.finalY ?? 160
    doc.text(`Grand total: ${formatCurrency(totalAmount)}`, 40, summaryY + 32)

    doc.save(`${slugify(title || 'invoice')}.pdf`)
  }

  const handleAddBillingHistory = async () => {
    if (lines.length === 0 || hasInvalidLine) {
      toast.error('Add valid items before saving billing history')
      return
    }
    setSavingInvoice(true)
    try {
      const items: BillingHistoryLineInput[] = lines.map((line) => ({
        itemId: line.id,
        name: line.name,
        sku: line.sku ?? null,
        unit: line.unit ?? null,
        quantity: line.quantity,
        price: line.price,
        amount: Number((line.quantity * line.price).toFixed(2)),
      }))
      const entry = await addBillingHistoryEntry({
        invoiceNo,
        invoiceDate: new Date().toISOString(),
        partyName: selectedPartyName || undefined,
        paymentMethod,
        status: billingStatus,
        totalAmount: Number(totalAmount.toFixed(2)),
        items,
      })
      setSavedInvoiceId(entry.id)
      setInvoiceNo(entry.invoiceNo)
      setBillingStatus(entry.status)
      toast.success(savedInvoiceId ? 'Billing history updated' : 'Billing history saved')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save billing history'
      toast.error(message)
    } finally {
      setSavingInvoice(false)
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const payload: SaleLineInput[] = lines.map((line) => ({
        itemId: line.id,
        quantity: line.quantity,
        price: line.price,
      }))
      const partyName = selectedPartyName || undefined
      const result = await recordSale(payload, {
        partyId: selectedParty?.id,
        partyName,
        paymentMethod,
        invoiceNo,
        billingStatus,
      })
      toast.success(`Sale recorded - ${formatCurrency(result.totalAmount)}`)
      setLines([])
      setSearchTerm('')
      setSuggestions([])
      setPartyQuery('')
      setSelectedParty(null)
      setBillingStatus('paid')
      setSavedInvoiceId(null)
      setSavingInvoice(false)
      onSaleComplete?.()
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to record sale'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]" />
        <DialogContent className="fixed z-[80] top-1/2 left-1/2 w-[95vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-900">Record a sale</DialogTitle>
              <p className="text-sm text-muted-foreground">Select items from stock, choose a party, and confirm to reduce inventory.</p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                <span>Invoice</span>
                <span>{invoiceNo}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-muted/60"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="party-search">
                    Party / customer
                  </label>
                  <div className="relative">
                    <Input
                      id="party-search"
                      value={partyQuery}
                      onChange={(event) => {
                        setPartyQuery(event.target.value)
                        setSelectedParty(null)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          const value = event.currentTarget.value.trim()
                          if (value) {
                            event.preventDefault()
                            setSelectedParty({ name: value })
                            setPartyQuery(value)
                            setShowPartySuggestions(false)
                          }
                        }
                      }}
                      onFocus={() => setShowPartySuggestions(true)}
                      onBlur={() => setTimeout(() => setShowPartySuggestions(false), 120)}
                      placeholder="Search or enter a party name"
                      autoComplete="off"
                      className="pl-9"
                    />
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    {showPartySuggestions && (partySuggestions.length > 0 || partyQuery.trim()) && (
                      <div className="absolute z-[90] mt-2 max-h-52 w-full overflow-y-auto rounded-lg border bg-white shadow-xl">
                        {partySuggestions.length > 0 ? (
                          partySuggestions.map((party) => (
                            <button
                              key={party.id ?? party.name}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setSelectedParty({ id: party.id, name: party.name })
                                setPartyQuery(party.name)
                                setShowPartySuggestions(false)
                              }}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                            >
                              <span className="truncate font-medium text-slate-900">{party.name}</span>
                              {party.id && <span className="text-xs text-muted-foreground">Saved</span>}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Press enter to use "{partyQuery.trim()}"</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="payment-method">
                    Payment method
                  </label>
                  <select
                    id="payment-method"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as SalePaymentMethod)}
                    className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="online">Online</option>
                    <option value="cheque">Cheque</option>
                    <option value="credit">Credit</option>
                  </select>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="billing-status">
                      Billing status
                    </label>
                    <select
                      id="billing-status"
                      value={billingStatus}
                      onChange={(event) => {
                        setBillingStatus(event.target.value as BillingStatus)
                        setSavedInvoiceId(null)
                      }}
                      className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <option value="paid">Paid</option>
                      <option value="pending">Credit / Pending</option>
                      <option value="failed">Failed</option>
                    </select>
                    <div className="text-xs text-muted-foreground">
                      Current status:
                      <span className={`ml-2 inline-flex items-center rounded-md border px-2 py-0.5 font-semibold ${billingStatusClass}`}>
                        {billingStatusLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="sale-search">
                  Search items to add
                </label>
                <div className="relative">
                  <Input
                    id="sale-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by name or SKU"
                    className="pl-9"
                    autoComplete="off"
                  />
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  {open && (suggestions.length > 0 || fetchingItems) && (
                    <div className="absolute z-[90] mt-2 max-h-60 w-full overflow-y-auto rounded-lg border bg-white shadow-xl">
                      {fetchingItems && (
                        <div className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                        </div>
                      )}
                      {!fetchingItems &&
                        suggestions.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => addCandidate(item)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium text-slate-900">{item.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {item.sku ? `SKU ${item.sku}` : 'No SKU'} - In stock {formatQty(item.stock)}
                              </div>
                            </div>
                            <div className="text-right text-sm font-semibold text-slate-900">{formatCurrency(item.price || 0)}</div>
                          </button>
                        ))}
                      {!fetchingItems && suggestions.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No items with available stock.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-left">Quantity</th>
                    <th className="px-3 py-2 text-left">Price</th>
                    <th className="px-3 py-2 text-right">Line total</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const lineTotal = line.quantity * line.price
                    const hasError = line.quantity <= 0 || line.quantity > line.stock
                    return (
                      <tr key={line.id} className="border-t">
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium text-slate-900">{line.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {line.sku ? `SKU ${line.sku}` : 'No SKU'} - Available {formatQty(line.stock)} {line.unit ?? ''}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={line.quantity}
                            onChange={(e) => updateQuantity(line.id, e.target.value)}
                            className={hasError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.price}
                            onChange={(e) => updatePrice(line.id, e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2 text-right align-top font-semibold text-slate-900">
                          {formatCurrency(lineTotal)}
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)} aria-label={`Remove ${line.name}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                  {lines.length === 0 && (
                    <tr>
                      <td className="px-3 py-8 text-center text-sm text-muted-foreground" colSpan={5}>
                        Add items from the search box to create a sale.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {lines.length > 0
                  ? hasInvalidLine
                    ? 'Adjust quantities to be within available stock.'
                    : `${lines.length} item${lines.length === 1 ? '' : 's'} selected`
                  : 'No items selected yet.'}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateInvoice}
                  disabled={lines.length === 0 || hasInvalidLine}
                  className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <FileText className="mr-2 h-4 w-4" /> Download invoice
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddBillingHistory}
                  disabled={lines.length === 0 || hasInvalidLine || savingInvoice}
                  className={billingButtonClasses}
                >
                  {savingInvoice ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : savedInvoiceId ? (
                    <>
                      <Check className="mr-2 h-4 w-4" /> {billingButtonLabel}
                    </>
                  ) : (
                    <>
                      <History className="mr-2 h-4 w-4" /> {billingButtonLabel}
                    </>
                  )}
                </Button>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Total amount</div>
                  <div className="text-xl font-semibold text-slate-900">{formatCurrency(totalAmount)}</div>
                </div>
                <Button onClick={handleSubmit} disabled={!canSubmit}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Record sale'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}


