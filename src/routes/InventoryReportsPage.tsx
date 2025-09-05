import { useEffect, useMemo, useState } from 'react'
import InventoryNav from '../features/inventory/InventoryNav'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { getStockReport, getPurchaseHistory, getPartyPurchaseHistory } from '../services/inventoryItems'
import { formatCurrency } from '../lib/format'
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog'
import { useInvCategories, useInvSubcategories } from '../hooks/useInventory'
import { useParties } from '../hooks/useParties'
import { Filter } from 'lucide-react'

export default function InventoryReportsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [lines, setLines] = useState<any[]>([])
  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { data: categories } = useInvCategories()
  const [catId, setCatId] = useState<string | undefined>(undefined)
  const { data: subs } = useInvSubcategories(catId)
  const [subId, setSubId] = useState<string | undefined>(undefined)
  const { data: parties } = useParties()
  const [partyId, setPartyId] = useState<string>('')
  const [partyItemIds, setPartyItemIds] = useState<Set<string> | null>(null)

  useEffect(() => { setSubId(undefined) }, [catId])

  // When party changes, precompute item ids purchased by that party
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!partyId) { setPartyItemIds(null); return }
      const rows = await getPartyPurchaseHistory(partyId)
      if (!active) return
      const ids = new Set<string>()
      for (const r of rows) { if (r.item?.id) ids.add(r.item.id) }
      setPartyItemIds(ids)
    })()
    return () => { active = false }
  }, [partyId])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const rows = await getStockReport()
        if (!active) return
        setItems(rows)
      } finally {
        setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((it) => {
      // Text search (name or sku)
      if (q && !((it.name || '').toLowerCase().includes(q) || (it.sku || '').toLowerCase().includes(q))) return false
      // Category / Subcategory
      if (catId && it.category_id && it.category_id !== catId) return false
      if (catId && !it.category_id && it.category !== categories.find((c:any)=>c.id===catId)?.name) return false
      if (subId && it.subcategory_id && it.subcategory_id !== subId) return false
      if (subId && !it.subcategory_id && it.subcategory !== subs.find((s:any)=>s.id===subId)?.name) return false
      // Party filter (must be purchased by selected party at least once)
      if (partyItemIds && !partyItemIds.has(it.id)) return false
      return true
    })
  }, [items, search, catId, subId, partyItemIds, categories, subs])

  return (
    <div className="space-y-4">
      <InventoryNav />

      <div className="border rounded-md p-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="grow min-w-[16rem]">
            <label className="text-sm">Search items</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or SKU" />
          </div>
          <div className="ml-auto">
            <Button variant="outline" onClick={() => setFiltersOpen(true)}>
              <Filter className="mr-2" size={16} /> Filters
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left sticky left-0 bg-muted/50">Item</th>
              <th className="p-2 text-left">SKU</th>
              <th className="p-2 text-left">Category</th>
              <th className="p-2 text-left">Subcategory</th>
              <th className="p-2 text-right">Price</th>
              <th className="p-2 text-right">Stock</th>
              <th className="p-2 text-right">Value</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <tr key={it.id} className="border-t hover:bg-muted/30">
                <td className="p-2 font-medium sticky left-0 bg-background">{it.name}</td>
                <td className="p-2">{it.sku || '-'}</td>
                <td className="p-2">{it.category || '-'}</td>
                <td className="p-2">{it.subcategory || '-'}</td>
                <td className="p-2 text-right">{formatCurrency(it.price || 0)}</td>
                <td className="p-2 text-right">{Number(it.stock || 0).toFixed(2)}</td>
                <td className="p-2 text-right">{formatCurrency(it.value || 0)}</td>
                <td className="p-2 text-right">
                  <Button size="sm" variant="outline" onClick={async () => {
                    setOpenItemId(it.id)
                    setLines(await getPurchaseHistory({ itemId: it.id }))
                  }}>Details</Button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td className="p-2 text-muted-foreground" colSpan={8}>No items found</td></tr>
            )}
            {loading && (
              <tr><td className="p-2" colSpan={8}>Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Filters dialog */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="bg-white border rounded-md p-4 shadow-xl max-w-xl w-[95vw]">
          <DialogTitle>Filter Inventory</DialogTitle>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Category</label>
              <select className="h-9 w-full border rounded-md px-2" value={catId || ''} onChange={(e) => setCatId(e.target.value || undefined)}>
                <option value="">All categories</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm">Subcategory</label>
              <select className="h-9 w-full border rounded-md px-2" value={subId || ''} onChange={(e) => setSubId(e.target.value || undefined)} disabled={!catId}>
                <option value="">{catId ? 'All subcategories' : 'Choose category first'}</option>
                {subs.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm">Party</label>
              <select className="h-9 w-full border rounded-md px-2" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                <option value="">All parties</option>
                {parties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="outline" onClick={() => { setCatId(undefined); setSubId(undefined); setPartyId(''); }}>Reset</Button>
            <Button onClick={() => setFiltersOpen(false)}>Apply</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openItemId} onOpenChange={() => { setOpenItemId(null); setLines([]) }}>
        <DialogContent className="bg-white border rounded-md p-4 shadow-xl max-w-3xl w-[95vw]">
          <DialogTitle>Item Purchase Details</DialogTitle>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Party</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Amount</th></tr></thead>
              <tbody>
                {lines.map((r: any, i: number) => (
                  <tr key={i} className="border-t"><td className="p-2">{r.purchase?.purchase_date}</td><td className="p-2">{r.purchase?.party?.name}</td><td className="p-2 text-right">{Number(r.qty).toFixed(2)}</td><td className="p-2 text-right">{formatCurrency(r.rate)}</td><td className="p-2 text-right">{formatCurrency(r.amount)}</td></tr>
                ))}
                {lines.length === 0 && <tr><td className="p-2 text-muted-foreground" colSpan={5}>No purchases</td></tr>}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
