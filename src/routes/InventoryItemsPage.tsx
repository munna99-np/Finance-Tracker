import { useEffect, useState } from 'react'
import InventoryNav from '../features/inventory/InventoryNav'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import ItemsTable from '../features/inventory/ItemsTable'
import { useInvCategories, useInvSubcategories } from '../hooks/useInventory'
import { addItem } from '../services/inventoryItems'
import { toast } from 'sonner'
// Record Purchase dialog removed

export default function InventoryItemsPage() {
  const [catId, setCatId] = useState<string | undefined>(undefined)
  const { data: categories } = useInvCategories()
  const { data: subs } = useInvSubcategories(catId)
  const [subId, setSubId] = useState<string | undefined>(undefined)

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [itemSearch, setItemSearch] = useState('')
  // Listen to global search from topbar
  useEffect(() => {
    const handler = (e: any) => setItemSearch(e?.detail?.query ?? '')
    window.addEventListener('app:search', handler as any)
    return () => window.removeEventListener('app:search', handler as any)
  }, [])

  useEffect(() => { setSubId(undefined) }, [catId])

  const canAdd = Boolean(subId)
  const addNew = async () => {
    if (!subId) return toast.error('Select a subcategory')
    const n = name.trim(); if (!n) return toast.error('Item name is required')
    try {
      setSaving(true)
      await addItem(subId, n, sku.trim() || null, Number(price || 0), 0)
      toast.success('Item added')
      setName(''); setSku(''); setPrice('')
      setRefreshKey((k) => k + 1)
    } catch (e: any) { toast.error(e.message || 'Failed to add') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <InventoryNav />

      <div className="border rounded-md p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-[12rem]">
            <label className="text-sm">Category</label>
            <select className="h-9 w-full border rounded-md px-2" value={catId || ''} onChange={(e) => setCatId(e.target.value || undefined)}>
              <option value="">Select category</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="w-full sm:w-[14rem]">
            <label className="text-sm">Subcategory</label>
            <select className="h-9 w-full border rounded-md px-2" value={subId || ''} onChange={(e) => setSubId(e.target.value || undefined)} disabled={!catId}>
              <option value="">{catId ? 'Select subcategory' : 'Choose category first'}</option>
              {subs.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grow min-w-[16rem]">
            <label className="text-sm">Search items</label>
            <Input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Name or SKU" />
          </div>
          <div className="grow min-w-[16rem]">
            <label className="text-sm">Item name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cement 50kg" />
          </div>
          <div className="w-full sm:w-[10rem]">
            <label className="text-sm">SKU</label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" />
          </div>
          <div className="w-full sm:w-[8rem]">
            <label className="text-sm">Price</label>
            <Input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
          </div>
          
          <div className="ml-auto flex items-end gap-2">
            <Button onClick={addNew} disabled={!canAdd || saving}>{saving ? 'Adding…' : 'Add Item'}</Button>
          </div>
        </div>
      </div>

      <div key={refreshKey}>
        {subId ? (
          <ItemsTable subcategoryId={subId} search={itemSearch} />
        ) : (
          <div className="text-sm text-muted-foreground border rounded-md p-3">Select a subcategory to view items.</div>
        )}
      </div>

      
    </div>
  )
}


