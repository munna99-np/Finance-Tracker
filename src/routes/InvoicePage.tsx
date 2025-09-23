import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { useParties } from '../hooks/useParties'
import { formatCurrency } from '../lib/format'
import { printHtml } from '../lib/print'
import { searchItems, getLatestPurchaseRate } from '../services/inventoryItems'

type Line = {
  itemId?: string
  name: string
  qty: number
  price: number
}

// (debounce utility removed; no item search suggestions)

export default function InvoicePage() {
  const { data: parties } = useParties()
  const [partyQuery, setPartyQuery] = useState('')
  const [partyId, setPartyId] = useState<string | undefined>()
  const [partyAddress, setPartyAddress] = useState('')
  // Pay To details (persist last used)
  const [bankName, setBankName] = useState<string>(() => localStorage.getItem('invoice_payto_bank') || '')
  const [bankAccountName, setBankAccountName] = useState<string>(() => localStorage.getItem('invoice_payto_account_name') || '')
  const [bankAccountNo, setBankAccountNo] = useState<string>(() => localStorage.getItem('invoice_payto_account_no') || '')
  const [partyOpen, setPartyOpen] = useState(false)
  const [partyHighlight, setPartyHighlight] = useState(0)
  const selectedParty = useMemo(() => parties.find((p) => p.id === partyId), [partyId, parties])

  // Auto details
  const [invoiceNo, setInvoiceNo] = useState<string>('')
  const [date, setDate] = useState<string>('')
  useEffect(() => {
    const today = new Date()
    const d = today.toISOString().slice(0, 10)
    setDate(d)
    // INV-YYYYMMDD-XXXX
    const seq = String(today.getTime()).slice(-4)
    setInvoiceNo(`INV-${d.replace(/-/g, '')}-${seq}`)
  }, [])

  // Lines
  const [lines, setLines] = useState<Line[]>([])
  const removeLine = (idx: number) => setLines((l) => l.filter((_, i) => i !== idx))

  // Product autocomplete (from stock)
  const [addQuery, setAddQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addSuggestions, setAddSuggestions] = useState<any[]>([])
  const [addFocusIdx, setAddFocusIdx] = useState(-1)
  const addBoxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!addBoxRef.current) return
      if (!addBoxRef.current.contains(e.target as any)) setAddOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const q = addQuery.trim()
      if (!q) { setAddSuggestions([]); return }
      setAddLoading(true)
      try {
        const rows = await searchItems(q)
        if (!active) return
        setAddSuggestions(rows)
      } catch {}
      finally { if (active) setAddLoading(false) }
    })()
    return () => { active = false }
  }, [addQuery])

  async function addFromSuggestion(it: any) {
    let rate: number | undefined
    try { rate = await getLatestPurchaseRate(it.id) } catch {}
    setLines((ls) => [
      ...ls,
      { itemId: it.id, name: it.name, qty: 1, price: typeof rate === 'number' ? rate : Number(it.price || 0) },
    ])
    setAddQuery(''); setAddSuggestions([]); setAddOpen(false); setAddFocusIdx(-1)
  }

  function addFreeItem() {
    const n = addQuery.trim()
    if (!n) return
    setLines((ls) => [...ls, { name: n, qty: 1, price: 0 }])
    setAddQuery(''); setAddSuggestions([]); setAddOpen(false); setAddFocusIdx(-1)
  }

  const subtotal = useMemo(() => lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.price || 0), 0), [lines])
  const [vatPercent, setVatPercent] = useState<number>(10)
  const vatAmount = useMemo(() => (subtotal * Number(vatPercent || 0)) / 100, [subtotal, vatPercent])
  const total = subtotal + vatAmount

  // Auto-fill party from query
  const matchedParties = useMemo(() => {
    const q = partyQuery.trim().toLowerCase()
    if (!q) return []
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
    const nq = norm(q)
    return parties
      .filter((p) => {
        const target = `${p.name} ${(p as any).phone || ''}`
        const ns = norm(target)
        return ns.includes(nq)
      })
      .slice(0, 8)
  }, [partyQuery, parties])

  useEffect(() => {
    if (selectedParty && !partyAddress) {
      const addr = (selectedParty as any).notes || ''
      if (addr) setPartyAddress(String(addr))
    }
  }, [selectedParty, partyAddress])

  const formRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    const issuedTo = `
      <div>
        <div style="font-weight:600;font-size:12px;color:#64748b;margin-bottom:6px;">ISSUED TO:</div>
        <div style="white-space:pre-line">${(selectedParty?.name || partyQuery) ?? ''}\n${partyAddress || ''}</div>
      </div>`
    const right = `
      <table style="font-size:12px" class="muted">
        <tr><td style="padding:2px 8px 2px 0">INVOICE NO:</td><td style="font-weight:700;color:#0f172a">${invoiceNo}</td></tr>
        <tr><td style="padding:2px 8px 2px 0">DATE:</td><td>${date}</td></tr>
      </table>`
    const payTo = `
      <div>
        <div style="font-weight:600;font-size:12px;color:#64748b;margin:12px 0 6px;">PAY TO:</div>
        <div>${bankName || ''}</div>
        <div>Account Name: ${bankAccountName || ''}</div>
        <div>Account No.: ${bankAccountNo || ''}</div>
      </div>`
    const head = `<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px"><div style="max-width:60%">${issuedTo}${payTo}</div><div style="text-align:right"><div style="font-size:22px;letter-spacing:.18em;margin-bottom:10px;color:#0f172a">INVOICE</div>${right}</div></div>`

    const bodyRows = lines
      .filter((l) => (l.name || '').trim())
      .map((l, i) => `<tr><td>${i + 1}</td><td>${l.name}</td><td class="num">${formatCurrency(Number(l.price))}</td><td class="num">${Number(l.qty).toFixed(2)}</td><td class="num">${formatCurrency(Number(l.qty * l.price))}</td></tr>`) 
      .join('')
    const table = `
      <table style="border-collapse:collapse;width:100%;font-size:12px;margin-top:6px">
        <tbody>
          <tr style="color:#64748b;text-transform:uppercase;letter-spacing:.03em;font-weight:600;font-size:11px">
            <td style="text-align:left;padding:6px 10px;border-bottom:1px solid #e5e7eb;width:36px">#</td>
            <td style="text-align:left;padding:6px 10px;border-bottom:1px solid #e5e7eb">Description</td>
            <td style="text-align:right;padding:6px 10px;border-bottom:1px solid #e5e7eb;width:120px">Unit Price</td>
            <td style="text-align:right;padding:6px 10px;border-bottom:1px solid #e5e7eb;width:90px">Qty</td>
            <td style="text-align:right;padding:6px 10px;border-bottom:1px solid #e5e7eb;width:130px">Total</td>
          </tr>
          ${bodyRows || '<tr><td colspan="5" style="padding:10px;border-top:1px solid #e5e7eb;color:#64748b">No items</td></tr>'}
        </tbody>
      </table>`

    const summary = `
      <div style="margin-top:12px;display:flex;justify-content:flex-end">
        <table style="width:320px">
          <tbody>
            <tr><td>SUBTOTAL</td><td class="num">${formatCurrency(subtotal)}</td></tr>
            <tr><td>Tax (${vatPercent}%)</td><td class="num">${formatCurrency(vatAmount)}</td></tr>
            <tr><td style="font-weight:700">TOTAL</td><td class="num" style="font-weight:700">${formatCurrency(total)}</td></tr>
          </tbody>
        </table>
      </div>`

    printHtml('Invoice', `${head}${table}${summary}`, { primary: '#0f172a', accent: '#0f172a' })
  }

  return (
    <div className="max-w-5xl mx-auto" ref={formRef}>
      <div className="mb-6 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-widest">INVOICE</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handlePrint()}>Print</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Party</label>
          <div className="relative">
            <Input
              placeholder="Search party..."
              value={partyQuery}
              onFocus={() => {
                setPartyOpen(true)
              }}
              onKeyDown={(e) => {
                if (!partyOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) setPartyOpen(true)
                if (e.key === 'ArrowDown') { e.preventDefault(); setPartyHighlight((i) => Math.min(i + 1, Math.max(0, matchedParties.length - 1))) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setPartyHighlight((i) => Math.max(i - 1, 0)) }
                else if (e.key === 'Enter' && partyOpen && matchedParties[partyHighlight]) {
                  const p = matchedParties[partyHighlight]
                  setPartyId(p.id)
                  setPartyQuery(p.name)
                  setPartyOpen(false)
                } else if (e.key === 'Escape') {
                  setPartyOpen(false)
                }
              }}
              onBlur={() => {
                // slight delay so click on suggestion can register
                setTimeout(() => setPartyOpen(false), 120)
              }}
              onChange={(e) => {
                const v = e.target.value
                setPartyQuery(v)
                setPartyId(undefined)
                setPartyOpen(true)
                setPartyHighlight(0)
              }}
            />
            {partyOpen && matchedParties.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow">
                {matchedParties.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${i === partyHighlight ? 'bg-muted/50' : ''}`}
                    onMouseEnter={() => setPartyHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setPartyId(p.id); setPartyQuery(p.name); setPartyOpen(false) }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="block text-sm font-medium">Address</label>
          <textarea
            className="w-full h-24 rounded-md border p-2 text-sm"
            placeholder="Party address"
            value={partyAddress}
            onChange={(e) => setPartyAddress(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 content-start">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Invoice No</label>
            <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Tax %</label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={vatPercent}
              onChange={(e) => setVatPercent(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2 col-span-2">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium">Pay To - Bank</label>
                <Input value={bankName} onChange={(e) => { setBankName(e.target.value); localStorage.setItem('invoice_payto_bank', e.target.value) }} placeholder="Borcele Bank" />
              </div>
              <div>
                <label className="block text-sm font-medium">Account Name</label>
                <Input value={bankAccountName} onChange={(e) => { setBankAccountName(e.target.value); localStorage.setItem('invoice_payto_account_name', e.target.value) }} placeholder="Adeline Palmerston" />
              </div>
              <div>
                <label className="block text-sm font-medium">Account No.</label>
                <Input value={bankAccountNo} onChange={(e) => { setBankAccountNo(e.target.value); localStorage.setItem('invoice_payto_account_no', e.target.value) }} placeholder="0123 4567 8901" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add product box */}
      <div className="border rounded-md p-3" ref={addBoxRef}>
        <div className="font-medium mb-2">Add product</div>
        <div className="relative">
          <Input
            placeholder="Type product name or SKU"
            value={addQuery}
            onChange={(e) => { setAddQuery(e.target.value); setAddOpen(true); setAddFocusIdx(-1) }}
            onFocus={() => setAddOpen(true)}
            onKeyDown={(e) => {
              if (!addOpen) return
              if (e.key === 'ArrowDown') { e.preventDefault(); setAddFocusIdx((i) => Math.min((addSuggestions.length - 1), i + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setAddFocusIdx((i) => Math.max(-1, i - 1)) }
              if (e.key === 'Enter') {
                e.preventDefault()
                if (addFocusIdx >= 0 && addSuggestions[addFocusIdx]) addFromSuggestion(addSuggestions[addFocusIdx])
                else addFreeItem()
              }
            }}
          />
          {addOpen && (addQuery.trim() || addLoading) && (
            <div className="absolute z-10 left-0 right-0 mt-1 border rounded-md bg-white shadow-sm max-h-60 overflow-auto">
              {addLoading && <div className="p-2 text-sm text-muted-foreground">Searching…</div>}
              {!addLoading && addSuggestions.length === 0 && (
                <div className="p-2 text-sm">
                  <div className="text-muted-foreground">Item not available in stock</div>
                  <Button className="mt-1" size="sm" onClick={addFreeItem}>Add “{addQuery.trim()}”</Button>
                </div>
              )}
              {!addLoading && addSuggestions.map((s, idx) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => addFromSuggestion(s)}
                  className={`w-full text-left p-2 text-sm hover:bg-muted/40 ${addFocusIdx === idx ? 'bg-muted/40' : ''}`}
                >
                  <div className="font-medium">{s.name} <span className="text-xs text-muted-foreground">{s.sku || ''}</span></div>
                  <div className="text-xs text-muted-foreground">In stock: {Number(s.stock || 0).toFixed(2)} • Price: {formatCurrency(Number(s.price || 0))}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_120px_100px] gap-px bg-muted text-xs font-medium uppercase tracking-wide">
          <div className="bg-muted/40 px-3 py-2">Description</div>
          <div className="bg-muted/40 px-3 py-2 text-right">Unit Price</div>
          <div className="bg-muted/40 px-3 py-2 text-right">Qty</div>
          <div className="bg-muted/40 px-3 py-2 text-right">Total</div>
        </div>
        {lines.map((line, idx) => {
          const total = Number(line.qty || 0) * Number(line.price || 0)
          return (
            <div key={idx} className="grid grid-cols-[1fr_120px_120px_100px] gap-px border-t">
              <div className="relative">
                <Input
                  className="border-0"
                  placeholder="Item description"
                  value={line.name}
                  onChange={(e) => {
                    const v = e.target.value
                    setLines((arr) => arr.map((l, i) => (i === idx ? { ...l, name: v } : l)))
                  }}
                />
              </div>
              <div className="px-3 py-2 text-right">
                <Input
                  className="text-right"
                  type="number"
                  step="0.01"
                  value={line.price}
                  onChange={(e) => setLines((arr) => arr.map((l, i) => (i === idx ? { ...l, price: Number(e.target.value) } : l)))}
                />
              </div>
              <div className="px-3 py-2 text-right">
                <Input
                  className="text-right"
                  type="number"
                  step="0.01"
                  value={line.qty}
                  onChange={(e) => setLines((arr) => arr.map((l, i) => (i === idx ? { ...l, qty: Number(e.target.value) } : l)))}
                />
              </div>
              <div className="px-3 py-2 text-right flex items-center justify-between gap-2">
                <div className="text-sm tabular-nums">{formatCurrency(total)}</div>
                <button className="text-xs text-muted-foreground hover:underline" onClick={() => removeLine(idx)}>Remove</button>
              </div>
            </div>
          )
        })}
        <div className="border-t bg-muted/20 px-3 py-2 flex items-center justify-end">
          <div className="text-sm">Subtotal: <span className="font-medium">{formatCurrency(subtotal)}</span></div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-6 text-sm">
        <div>Tax: <span className="font-medium">{vatPercent}%</span></div>
        <div>Tax Amount: <span className="font-medium">{formatCurrency(vatAmount)}</span></div>
        <div>Total: <span className="font-semibold">{formatCurrency(total)}</span></div>
      </div>
    </div>
  )
}
