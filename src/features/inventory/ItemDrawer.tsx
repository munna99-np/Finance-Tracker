import { useInvItemDetails } from '../../hooks/useInventory'
import { Button } from '../../components/ui/button'
import { formatCurrency } from '../../lib/format'
import InfoOutlined from '@mui/icons-material/InfoOutlined'

export default function ItemDrawer({ itemId, onRecordPurchase }: { itemId?: string; onRecordPurchase: () => void }) {
  const { item, purchases } = useInvItemDetails(itemId)
  if (!itemId) return <div className="text-sm text-muted-foreground">Select an item</div>
  if (!item) return <div className="text-sm text-muted-foreground">Loading…</div>
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <InfoOutlined style={{ fontSize: 16 }} />
          </span>
          <div>
            <div className="text-lg font-semibold">{item.name}</div>
            <div className="text-xs text-muted-foreground">SKU: {item.sku || '-'} • {item.subcategory?.category?.name} / {item.subcategory?.name}</div>
          </div>
        </div>
        <Button onClick={onRecordPurchase}>Record Purchase</Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Price" value={formatCurrency(item.price || 0)} />
        <Stat label="In Stock" value={(Number(item.stock)).toFixed(2)} />
        <Stat label="SKU" value={String(item.sku || '-')} />
      </div>
      <div>
        <div className="font-medium mb-1">Recent Purchases</div>
        <div className="border rounded-md overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Party</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Amount</th></tr></thead>
            <tbody>
              {(purchases || []).map((r: any, i: number) => (
                <tr key={i} className="border-t"><td className="p-2">{r.purchase?.purchase_date}</td><td className="p-2">{r.purchase?.party?.name}</td><td className="p-2 text-right">{Number(r.qty).toFixed(2)}</td><td className="p-2 text-right">{formatCurrency(r.rate)}</td><td className="p-2 text-right">{formatCurrency(r.amount)}</td></tr>
              ))}
              {(!purchases || purchases.length === 0) && <tr><td className="p-2 text-muted-foreground" colSpan={5}>No purchases</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  )
}
