import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { formatCurrency } from '../../lib/format'
import { toast } from 'sonner'
import { addItem, updateItem } from '../../services/inventoryItems'
import { Dialog, DialogContent, DialogTitle } from '../../components/ui/dialog'
import { useInvCategories, useInvSubcategories } from '../../hooks/useInventory'

type Row = {
  id: string
  name: string
  sku: string | null
  unit: string | null
  price: number
  stock: number
  min_stock: number
  max_stock?: number | null
  notes?: string | null
  subcategory?: { id: string; name: string; category?: { id: string; name: string } }
}

export default function StockTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [lastPrice, setLastPrice] = useState<Record<string, number>>({})
  const [editing, setEditing] = useState<Record<string, Partial<Row>>>({})
  const [addOpen, setAddOpen] = useState(false)
  const { data: categories } = useInvCategories()
  const [catId, setCatId] = useState<string | undefined>(undefined)
  const { data: subs } = useInvSubcategories(catId)
  const [subId, setSubId] = useState<string | undefined>(undefined)
  const [newItem, setNewItem] = useState({ name: '', sku: '', unit: 'pcs', price: 0, notes: '' })

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q) || (r.subcategory?.name || '').toLowerCase().includes(q) || (r.subcategory?.category?.name || '').toLowerCase().includes(q)
    )
  }, [rows, search])

  useEffect(() => {
    // Listen to global app search
    const searchHandler = (e: any) => setSearch(e?.detail?.query ?? '')
    window.addEventListener('app:search', searchHandler as any)
    return () => window.removeEventListener('app:search', searchHandler as any)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      const run = (fields: string) => supabase
        .from('inventory_items')
        .select(fields)
        .order('created_at', { ascending: false })
      let { data, error } = await run('id,name,sku,unit,price,stock,min_stock,max_stock,notes, subcategory:inventory_subcategories(id,name, category:inventory_categories(id,name))')
      if (error && String(error.message || '').toLowerCase().includes('max_stock') && String(error.message || '').includes('does not exist')) {
        ;({ data, error } = await run('id,name,sku,unit,price,stock,min_stock,notes, subcategory:inventory_subcategories(id,name, category:inventory_categories(id,name))'))
      }
      if (!active) return
      if (error) { toast.error(error.message); setLoading(false); return }
      const items = ((data as any[]) || []) as Row[]
      setRows(items)

      // Fetch last purchase rate per item (best-effort)
      const ids = items.map((i) => i.id)
      if (ids.length) {
        const { data: pi, error: e2 } = await supabase
          .from('inventory_purchase_items')
          .select('item_id,rate,id')
          .in('item_id', ids)
          .order('id', { ascending: false })
        if (!active) return
        if (e2) { /* non-fatal */ } else {
          const map: Record<string, number> = {}
          for (const line of (pi || []) as any[]) {
            if (map[line.item_id] === undefined) map[line.item_id] = Number(line.rate || 0)
          }
          setLastPrice(map)
        }
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  const startEdit = (id: string) => {
    const r = rows.find((x) => x.id === id)
    if (!r) return
    setEditing((e) => ({ ...e, [id]: { sku: r.sku ?? '', unit: r.unit ?? 'pcs', price: r.price, notes: r.notes ?? '' } }))
  }
  const cancelEdit = (id: string) => setEditing((e) => { const n = { ...e }; delete n[id]; return n })
  const saveEdit = async (id: string) => {
    const patch = editing[id]
    if (!patch) return
    try {
      await updateItem(id, {
        sku: patch.sku as any,
        unit: (patch.unit as any) || 'pcs',
        price: Number(patch.price ?? 0),
        notes: (patch.notes as any) ?? null,
      })
      setRows((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } as any : r))
      cancelEdit(id)
      toast.success('Updated')
    } catch (e: any) {
      toast.error(e.message || 'Failed to update')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Input className="h-9 w-72" placeholder="Search by name / SKU / category" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setAddOpen(true)}>Add Item</Button>
          <div className="text-xs text-muted-foreground">{rows.length} items</div>
        </div>
      </div>
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="max-h-[65vh] overflow-auto">
          <table className="min-w-[960px] w-full text-sm table-auto">
            <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
            <tr>
              <th className="p-2 text-left">Item Name</th>
              <th className="p-2 text-left whitespace-nowrap">SKU / Code</th>
              <th className="p-2 text-left">Category / Subcategory</th>
              <th className="p-2 text-left">Unit (UOM)</th>
              <th className="p-2 text-right">Purchase Price</th>
              <th className="p-2 text-right">Selling Price</th>
              <th className="p-2 text-left">Notes</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
            <tbody>
              {filtered.map((r) => {
                const ed = editing[r.id]
                return (
                  <tr key={r.id} className="border-t">
                  <td className="p-2 font-medium">{r.name}</td>
                  <td className="p-2 whitespace-nowrap">
                    {ed ? (
                      <Input value={String(ed.sku ?? '')} onChange={(e) => setEditing((m) => ({ ...m, [r.id]: { ...m[r.id], sku: e.target.value } }))} />
                    ) : (
                      r.sku || '-'
                    )}
                  </td>
                  <td className="p-2 max-w-[220px] truncate" title={`${r.subcategory?.category?.name || ''}${r.subcategory ? ` / ${r.subcategory.name}` : ''}`}>
                    {r.subcategory?.category?.name || '-'}{r.subcategory ? ` / ${r.subcategory.name}` : ''}
                  </td>
                  <td className="p-2 w-24">
                    {ed ? (
                      <Input value={String(ed.unit ?? 'pcs')} onChange={(e) => setEditing((m) => ({ ...m, [r.id]: { ...m[r.id], unit: e.target.value } }))} />
                    ) : (
                      r.unit || 'pcs'
                    )}
                  </td>
                  <td className="p-2 text-right">{formatCurrency(lastPrice[r.id] ?? 0)}</td>
                  <td className="p-2 text-right w-28 whitespace-nowrap">
                    {ed ? (
                      <Input type="number" inputMode="decimal" value={String(ed.price ?? 0)} onChange={(e) => setEditing((m) => ({ ...m, [r.id]: { ...m[r.id], price: Number(e.target.value || 0) } }))} />
                    ) : (
                      formatCurrency(r.price || 0)
                    )}
                  </td>
                  
                  <td className="p-2 max-w-[240px] truncate" title={r.notes || ''}>
                    {ed ? (
                      <Input value={String(ed.notes ?? '')} onChange={(e) => setEditing((m) => ({ ...m, [r.id]: { ...m[r.id], notes: e.target.value } }))} />
                    ) : (
                      r.notes || '-'
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {ed ? (
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => cancelEdit(r.id)}>Cancel</Button>
                        <Button size="sm" onClick={() => saveEdit(r.id)}>Save</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEdit(r.id)}>Edit</Button>
                    )}
                  </td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && (
              <tr><td className="p-2 text-muted-foreground" colSpan={10}>No items</td></tr>
            )}
              {loading && (
                <tr><td className="p-2" colSpan={10}>Loading...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-white border rounded-md p-4 shadow-xl max-w-2xl w-[95vw]">
          <DialogTitle>Add Item</DialogTitle>
          <div className="mt-2 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Category</label>
                <select className="h-9 w-full border rounded-md px-2" value={catId || ''} onChange={(e) => { setCatId(e.target.value || undefined); setSubId(undefined) }}>
                  <option value="">Select category</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">Subcategory</label>
                <select className="h-9 w-full border rounded-md px-2" value={subId || ''} disabled={!catId} onChange={(e) => setSubId(e.target.value || undefined)}>
                  <option value="">{catId ? 'Select subcategory' : 'Choose category first'}</option>
                  {subs.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm">Item name</label>
                <Input value={newItem.name} onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))} placeholder="e.g. Cement 50kg" />
              </div>
              <div>
                <label className="text-sm">SKU / Code</label>
                <Input value={newItem.sku} onChange={(e) => setNewItem((n) => ({ ...n, sku: e.target.value }))} placeholder="Optional" />
              </div>
              <div>
                <label className="text-sm">Unit (UOM)</label>
                <Input value={newItem.unit} onChange={(e) => setNewItem((n) => ({ ...n, unit: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm">Selling Price</label>
                <Input type="number" inputMode="decimal" value={String(newItem.price)} onChange={(e) => setNewItem((n) => ({ ...n, price: Number(e.target.value || 0) }))} />
              </div>
              
              <div className="md:col-span-2">
                <label className="text-sm">Notes</label>
                <Input value={newItem.notes} onChange={(e) => setNewItem((n) => ({ ...n, notes: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={async () => {
                if (!subId) return toast.error('Select a subcategory')
                const name = newItem.name.trim(); if (!name) return toast.error('Item name is required')
                try {
                  const created = await addItem(subId, name, newItem.sku || null, Number(newItem.price || 0), 0, undefined, { unit: newItem.unit, notes: newItem.notes || null })
                  // Prepend new row
                  const catName = (categories.find((c: any) => c.id === catId) as any)?.name
                  const subName = (subs.find((s: any) => s.id === subId) as any)?.name
                  setRows((rs) => [{
                    id: created.id,
                    name: created.name,
                    sku: created.sku || null,
                    unit: created.unit || 'pcs',
                    price: created.price || 0,
                    stock: created.stock || 0,
                    min_stock: (created as any).min_stock || 0,
                    max_stock: (created as any).max_stock || 0,
                    notes: (created as any).notes || null,
                    subcategory: { id: subId!, name: subName, category: { id: catId!, name: catName } }
                  } as any, ...rs])
                  setAddOpen(false)
                  setCatId(undefined); setSubId(undefined)
                  setNewItem({ name: '', sku: '', unit: 'pcs', price: 0, notes: '' })
                  toast.success('Item added')
                } catch (e: any) {
                  toast.error(e.message || 'Failed to add item')
                }
              }}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
