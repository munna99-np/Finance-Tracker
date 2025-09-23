import { useEffect, useMemo, useState } from 'react'
import { PieChart as RCPieChart, Pie, Tooltip, Cell, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../../lib/supabaseClient'

type Slice = { label: string; value: number }

function todayStr() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export default function DailySalesDonut() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('transactions')
        .select('date,amount,direction')
        .eq('date', todayStr())
      if (!active) return
      if (error) { setError(error.message); setLoading(false); return }
      setRows((data as any) || [])
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  const data: Slice[] = useMemo(() => {
    if (!rows.length) return []
    let inflow = 0, outflow = 0, transfer = 0
    for (const r of rows) {
      if (r.direction === 'in') inflow += Number(r.amount || 0)
      else if (r.direction === 'out') outflow += Math.abs(Number(r.amount || 0))
      else transfer += Math.abs(Number(r.amount || 0))
    }
    return [
      { label: 'Store Sales', value: inflow },
      { label: 'Refunds', value: outflow },
      { label: 'Transfers', value: transfer },
    ].filter((d) => d.value > 0)
  }, [rows])

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>
  if (error) return <div className="text-sm text-red-600">{error}</div>
  if (data.length === 0) return <div className="text-sm text-muted-foreground">No activity today</div>

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <RCPieChart>
          <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
          <Legend />
          <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={50} outerRadius={90} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell key={`cell-${entry.label}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </RCPieChart>
      </ResponsiveContainer>
    </div>
  )
}

const COLORS = [
  '#06B6D4', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6',
]
