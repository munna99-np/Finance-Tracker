import { useMemo, useState, useEffect } from 'react'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { useInvItems } from '../../hooks/useInventory'
import { formatCurrency } from '../../lib/format'

export default function ItemsTable({ subcategoryId, onOpen, search: externalSearch }: { subcategoryId?: string; onOpen?: (itemId: string) => void; search?: string }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const query = externalSearch ?? search
  const { data, total, limit, loading } = useInvItems({ subcategoryId, search: query, page })
  useEffect(() => { if (externalSearch !== undefined) setPage(1) }, [externalSearch])
  useEffect(() => { setPage(1) }, [subcategoryId])
  const [inStockOnly, setInStockOnly] = useState(false)
  const pages = Math.max(1, Math.ceil(total / limit))

  const filtered = useMemo(() => {
    let rows = data
    if (inStockOnly) rows = rows.filter((i) => Number(i.stock) > 0)
    return rows
  }, [data, inStockOnly])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {externalSearch === undefined && (
          <Input className="h-9 w-64" placeholder="Search items or SKU…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        )}
        <div className="flex items-center gap-3 text-xs">
          <label className="inline-flex items-center gap-1"><input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} /> In stock</label>
          <span className="text-muted-foreground">{total} items</span>
        </div>
      </div>
      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Item</th>
              <th className="text-left p-2">SKU</th>
              <th className="text-left p-2">Unit</th>
              <th className="text-right p-2">Price</th>
              <th className="text-right p-2">In stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <tr
                key={it.id}
                className={`border-t ${onOpen ? 'hover:bg-muted/30 cursor-pointer' : ''}`}
                onClick={() => onOpen?.(it.id)}
              >
                <td className="p-2 font-medium">{it.name}</td>
                <td className="p-2">{it.sku || '-'}</td>
                <td className="p-2">{it.unit}</td>
                <td className="p-2 text-right">{formatCurrency(it.price || 0)}</td>
                <td className="p-2 text-right">{Number(it.stock).toFixed(2)}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td className="p-2 text-muted-foreground" colSpan={5}>{loading ? 'Loading…' : 'No items'}</td>
            </tr>
          )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
        <div className="text-xs">Page {page} / {pages}</div>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next</Button>
      </div>
    </div>
  )
}
