import { useEffect, useMemo, useState } from 'react'
import { PieChart as RCPieChart, Pie, Tooltip, Cell, ResponsiveContainer, Legend } from 'recharts'
import { getStockReport, getPurchaseHistory } from '../../services/inventoryItems'
import { Dialog, DialogContent, DialogTitle } from '../../components/ui/dialog'
import { formatCurrency } from '../../lib/format'

type PieDatum = { id: string; value: number; label: string }

export default function InventoryPie() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [lines, setLines] = useState<any[]>([])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const rows = await getStockReport()
        if (!active) return
        setItems(rows)
      } catch (e: any) {
        if (!active) return
        setError(e.message || 'Failed to load inventory report')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const data: PieDatum[] = useMemo(() => {
    // Represent by inventory value (price * stock). If value=0, hide from chart but still listable.
    return items
      .map((it: any) => ({ id: it.id as string, value: Number(it.value || 0), label: it.name as string }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12) // limit to top 12 slices for readability
  }, [items])

  const onSliceClick = async (id?: string | number) => {
    if (!id) return
    const itemId = String(id)
    setOpenItemId(itemId)
    try {
      const hist = await getPurchaseHistory({ itemId })
      setLines(hist)
    } catch (e) {
      setLines([])
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading inventory…</div>
  if (error) return <div className="text-sm text-red-600">{error}</div>
  if (data.length === 0) return <div className="text-sm text-muted-foreground">No inventory value to chart</div>

  return (
    <>
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <RCPieChart>
            <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
            <Legend />
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              onClick={(entry: any) => onSliceClick(entry?.id)}
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${entry.id}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </RCPieChart>
        </ResponsiveContainer>
      </div>

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
    </>
  )
}

const COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6',
  '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#22C55E', '#EAB308',
]
