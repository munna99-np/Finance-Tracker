import { useEffect, useMemo, useState } from 'react'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { usePartySearch, useInvItems } from '../../hooks/useInventory'
import { supabase } from '../../lib/supabaseClient'
import { recordPurchaseLedger } from '../../services/inventoryItems'
import { toast } from 'sonner'
import MoneyInput from '../../components/fields/MoneyInput'

type Line = { item_id: string; name?: string; sku?: string | null; qty?: number; unit?: string | null; rate?: number; sell?: number }

export default function PurchaseForm({ onSaved, subcategoryId, partySearch, itemSearch }: { onSaved?: () => void; subcategoryId?: string; partySearch?: string; itemSearch?: string }) {
  const { data: parties } = usePartySearch(partySearch ?? '')
  const [partyId, setPartyId] = useState('')
  const [invoice, setInvoice] = useState('')
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [payment, setPayment] = useState<'cash' | 'credit' | 'bank' | ''>('')
  const [taxPercent, setTaxPercent] = useState<number>(0)
  const [taxAmount, setTaxAmount] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([{ item_id: '' }])
  const { data: items } = useInvItems({ search: itemSearch, page: 1, subcategoryId })
  const [saving, setSaving] = useState(false)

  const subTotal = useMemo(() => lines.reduce((s, l) => s + (Number(l.qty || 0) * Number(l.rate || 0)), 0), [lines])
  useEffect(() => {
    if (taxPercent && taxPercent > 0) {
      setTaxAmount(Number(((subTotal * taxPercent) / 100).toFixed(2)))
    }
  }, [subTotal, taxPercent])
  const total = useMemo(() => Math.max(0, subTotal + Number(taxAmount || 0)), [subTotal, taxAmount])

  useEffect(() => {
    setLines((ls) => ls.map((l) => {
      const it = items.find((i) => i.id === l.item_id)
      return { ...l, name: it?.name || l.name, sku: it?.sku ?? l.sku, unit: it?.unit ?? l.unit }
    }))
  }, [items])

  const addRow = () => setLines((ls) => [...ls, { item_id: '' }])
  const removeRow = (idx: number) => setLines((ls) => ls.filter((_, i) => i !== idx))

  const save = async () => {
    if (!partyId) return toast.error('Select a party')
    const valid = lines.filter((l) => l.item_id && Number(l.qty) > 0)
    if (valid.length === 0) return toast.error('Add at least one line with qty')
    setSaving(true)
    let ledgerFailure: string | null = null
    // Snapshot current stock for involved items (to detect absence of DB triggers)
    const itemIds = Array.from(new Set(valid.map((l) => l.item_id)))
    let before: Record<string, number> = {}
    try {
      if (itemIds.length) {
        const { data } = await supabase.from('inventory_items').select('id,stock').in('id', itemIds)
        before = Object.fromEntries((data || []).map((r: any) => [r.id, Number(r.stock || 0)]))
      }
    } catch {}
    let { data: pur, error } = await supabase
      .from('inventory_purchases')
      .insert({
        party_id: partyId,
        invoice_no: invoice || null,
        purchase_date: date,
        payment_type: payment || null,
        tax_amount: Number(taxAmount || 0),
        notes: notes || null,
        total_amount: total,
      })
      .select('id')
      .single()
    if (error && /column .* does not exist/i.test(String(error.message))) {
      // Retry with legacy schema without extra columns
      const res = await supabase
        .from('inventory_purchases')
        .insert({ party_id: partyId, invoice_no: invoice || null, purchase_date: date, total_amount: total })
        .select('id')
        .single()
      pur = res.data as any; error = res.error as any
    }
    if (error) { setSaving(false); return toast.error(error.message) }
    const rows = valid.map((l) => ({ purchase_id: pur!.id, item_id: l.item_id, qty: l.qty, rate: l.rate || 0 }))
    const { error: e2 } = await supabase.from('inventory_purchase_items').insert(rows)
    if (e2) { setSaving(false); return toast.error(e2.message) }

    // Ensure stock is increased (if DB doesn't do it via triggers)
    try {
      if (itemIds.length) {
        const { data: afterRows } = await supabase.from('inventory_items').select('id,stock').in('id', itemIds)
        const after = Object.fromEntries((afterRows || []).map((r: any) => [r.id, Number(r.stock || 0)]))
        const addByItem: Record<string, number> = {}
        for (const l of valid) addByItem[l.item_id] = (addByItem[l.item_id] || 0) + Number(l.qty || 0)
        for (const id of itemIds) {
          const b = Number(before[id] ?? 0)
          const a = Number(after[id] ?? 0)
          const inc = Number(addByItem[id] || 0)
          if (inc > 0 && a === b) {
            await supabase.from('inventory_items').update({ stock: b + inc }).eq('id', id)
          }
        }
      }
    } catch {}

    // Update selling price and unit on items if provided
    try {
      for (const l of valid) {
        const updates: any = {}
        if (typeof l.sell === 'number' && !Number.isNaN(l.sell)) updates.price = Number(l.sell)
        if (l.unit) updates.unit = l.unit
        if (Object.keys(updates).length) {
          await supabase.from('inventory_items').update(updates).eq('id', l.item_id)
        }
      }
    } catch {}

    try {
      await recordPurchaseLedger({
        partyId,
        amount: Number(total.toFixed(2)),
        paymentMethod: payment || null,
        entryDate: date,
        notes: notes || null,
        metadata: invoice ? { invoiceNo: invoice } : undefined,
      })
    } catch (error) {
      console.error('Failed to record purchase ledger', error)
      ledgerFailure = error instanceof Error ? error.message : 'Ledger update failed'
    }

    setSaving(false)
    if (ledgerFailure) {
      toast.error(`Purchase saved but ledger update failed: ${ledgerFailure}`)
    } else {
      toast.success('Purchase recorded')
    }
    setPartyId(''); setInvoice(''); setPayment(''); setTaxPercent(0); setTaxAmount(0); setNotes('')
    setLines([{ item_id: '' }])
    onSaved?.()
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Vendor & Bill Details</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Party / Vendor</label>
          <select className="h-9 w-full rounded-md border px-3 bg-white" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">Select party</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Bill / Invoice Number</label>
          <Input className="h-9" value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Bill / Invoice Date</label>
          <Input className="h-9" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Payment Type</label>
          <select className="h-9 w-full rounded-md border px-3 bg-white" value={payment} onChange={(e) => setPayment(e.target.value as any)}>
            <option value="">Select</option>
            <option value="cash">Cash</option>
            <option value="credit">Credit</option>
            <option value="bank">Bank</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tax % / Amount</label>
          <div className="flex gap-2">
            <Input className="h-9 w-24" placeholder="%" type="number" inputMode="decimal" value={String(taxPercent)} onChange={(e) => setTaxPercent(Number(e.target.value || 0))} />
            <Input className="h-9 w-32" placeholder="Amount" type="number" inputMode="decimal" value={String(taxAmount)} onChange={(e) => setTaxAmount(Number(e.target.value || 0))} />
          </div>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-foreground">Items</h3>
      <div className="border rounded-md shadow-sm overflow-x-auto w-full max-w-full bg-white">
        <table className="min-w-full text-sm table-auto">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Item Name</th>
              <th className="p-2 text-left">SKU / Code</th>
              <th className="p-2 text-left">Category / Subcategory</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-left">Unit (UOM)</th>
              <th className="p-2 text-right">Purchase Price</th>
              <th className="p-2 text-right">Selling Price</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-2">
                  <select className="h-9 w-full rounded-md border px-3 bg-white" value={l.item_id} onChange={(e) => {
                    const id = e.target.value; const it = items.find((i) => i.id === id)
                    setLines((ls) => ls.map((row, i) => i === idx ? { ...row, item_id: id, rate: row.rate ?? it?.price ?? 0, name: it?.name, sku: it?.sku ?? null, unit: it?.unit ?? 'pcs' } : row))
                  }}>
                    <option value="">Select item</option>
                    {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                  </select>
                </td>
                <td className="p-2 min-w-[120px] whitespace-nowrap align-middle">{l.sku || '-'}</td>
                <td className="p-2 min-w-[200px] max-w-[240px] truncate align-middle" title={'-'}>-</td>
                <td className="p-2 text-right whitespace-nowrap align-middle"><MoneyInput value={l.qty} onChange={(v) => setLines((ls) => ls.map((row, i) => i === idx ? { ...row, qty: v as number } : row))} /></td>
                <td className="p-2 w-28 align-middle"><Input className="h-9" value={l.unit || ''} onChange={(e) => setLines((ls) => ls.map((row, i) => i === idx ? { ...row, unit: e.target.value } : row))} placeholder="pcs / kg / bag" /></td>
                <td className="p-2 text-right whitespace-nowrap align-middle"><MoneyInput value={l.rate} onChange={(v) => setLines((ls) => ls.map((row, i) => i === idx ? { ...row, rate: v as number } : row))} /></td>
                <td className="p-2 text-right whitespace-nowrap align-middle"><MoneyInput value={l.sell} onChange={(v) => setLines((ls) => ls.map((row, i) => i === idx ? { ...row, sell: v as number } : row))} /></td>
                <td className="p-2 text-right whitespace-nowrap align-middle">{(Number(l.qty || 0) * Number(l.rate || 0)).toFixed(2)}</td>
                <td className="p-2 text-right align-middle"><Button size="sm" variant="outline" className="rounded-md" onClick={() => removeRow(idx)}>Remove</Button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="p-2" colSpan={9}>
                <div className="flex items-center justify-between">
                  <Button size="sm" variant="outline" className="rounded-md" onClick={addRow}>Add Row</Button>
                  <div className="text-sm text-muted-foreground">
                    Subtotal: <span className="font-medium">{subTotal.toFixed(2)}</span>
                    <span className="mx-2">|</span>
                    Tax: <span className="font-medium">{Number(taxAmount || 0).toFixed(2)}</span>
                    <span className="mx-2">|</span>
                    Total: <span className="font-medium">{total.toFixed(2)}</span>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <h3 className="text-sm font-semibold text-foreground">Summary & Notes</h3>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Notes / Remarks</label>
        <Input className="h-9" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>

      <div className="flex justify-end pt-2">
        <Button className="rounded-md shadow-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Purchase'}</Button>
      </div>
    </div>
  )
}

