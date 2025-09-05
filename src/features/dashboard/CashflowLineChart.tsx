import { useEffect, useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency } from '../../lib/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

type Row = { date: string; amount: number; direction: 'in' | 'out' | 'transfer' }

function monthKey(d: Date | string) {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

function firstDayMonthsAgo(n: number) {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - n, 1)
}

export default function CashflowLineChart() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      const from = firstDayMonthsAgo(11)
      const fromStr = from.toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('transactions')
        .select('date,amount,direction')
        .gte('date', fromStr)
        .order('date', { ascending: true })
      if (!active) return
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      setRows(((data as any) || []) as Row[])
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  const series = useMemo(() => {
    const months: string[] = []
    for (let i = 11; i >= 0; i -= 1) months.push(monthKey(firstDayMonthsAgo(i)))
    const totals = new Map(months.map((m) => [m, { inflow: 0, outflow: 0 }]))
    for (const r of rows) {
      const m = monthKey(r.date)
      if (!totals.has(m)) continue
      if (r.direction === 'in') totals.get(m)!.inflow += Number(r.amount || 0)
      else if (r.direction === 'out') totals.get(m)!.outflow += Math.abs(Number(r.amount || 0))
    }
    const inflow = months.map((m) => Number(totals.get(m)!.inflow.toFixed(2)))
    const outflow = months.map((m) => Number(totals.get(m)!.outflow.toFixed(2)))
    const net = months.map((_, i) => Number((inflow[i] - outflow[i]).toFixed(2)))
    return { months, inflow, outflow, net }
  }, [rows])

  if (loading) return <div className="h-56 flex items-center justify-center text-muted-foreground">Loading…</div>
  if (error) return <div className="h-56 flex items-center justify-center text-red-600 text-sm">{error}</div>

  const data = {
    labels: series.months,
    datasets: [
      {
        label: 'Inflow',
        data: series.inflow,
        borderColor: '#10B981',
        backgroundColor: 'rgba(16,185,129,0.15)',
        tension: 0.3,
        fill: true,
        pointRadius: 3,
      },
      {
        label: 'Outflow',
        data: series.outflow,
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239,68,68,0.12)',
        tension: 0.3,
        fill: true,
        pointRadius: 3,
      },
      {
        label: 'Net',
        data: series.net,
        borderColor: '#6366F1',
        backgroundColor: 'rgba(99,102,241,0.10)',
        tension: 0.35,
        fill: false,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false as const,
    plugins: {
      legend: { position: 'bottom' as const },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
        },
      },
      title: { display: false },
    },
    interaction: { mode: 'index' as const, intersect: false },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (v: any) => formatCurrency(Number(v)) } },
    },
  }

  return (
    <div className="h-56">
      <Line data={data} options={options as any} />
    </div>
  )
}

