import { useInvCategories, useInvItems } from '../../hooks/useInventory'

export default function InventoryReports() {
  const { data: cats } = useInvCategories()
  const { data: items, total } = useInvItems({ page: 1 })
  const totalItems = total
  const low = items.filter((i) => Number(i.stock) < Number(i.min_stock))
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <CardStat label="Total Items" value={totalItems.toString()} />
        <CardStat label="Total Categories" value={cats.length.toString()} />
        <CardStat label="Low Stock" value={low.length.toString()} />
      </div>
      <div>
        <div className="font-medium mb-1">Low Stock</div>
        <div className="border rounded-md overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="p-2 text-left">Item</th><th className="p-2 text-right">Stock</th><th className="p-2 text-right">Min</th></tr></thead>
            <tbody>
              {low.map((i) => (<tr key={i.id} className="border-t"><td className="p-2">{i.name}</td><td className="p-2 text-right">{Number(i.stock).toFixed(2)}</td><td className="p-2 text-right">{Number(i.min_stock).toFixed(2)}</td></tr>))}
              {low.length === 0 && <tr><td className="p-2 text-muted-foreground" colSpan={3}>All good</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  )
}
