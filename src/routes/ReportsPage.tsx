import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  IconAccounts,
  IconCategories,
  IconExport,
  IconParties,
  IconReports,
  IconTransactions,
} from '../components/icons'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { StatCard } from '../components/ui/stat-card'
import { useTransactions } from '../hooks/useTransactions'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { useParties } from '../hooks/useParties'
import { formatCurrency } from '../lib/format'
import { printHtml } from '../lib/print'
import { download } from '../lib/csv'

type GroupRow = {
  key: string
  name: string
  count: number
  inflow: number
  outflow: number
  net: number
}

const PIE_COLORS = ['#22C55E', '#EF4444']
const BAR_COLORS = ['#6366F1', '#0EA5E9', '#22C55E', '#F97316', '#F59E0B', '#14B8A6']
const FLOW_COLORS = {
  inflow: '#22C55E',
  outflow: '#EF4444',
  net: '#6366F1',
}

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export default function ReportsPage() {
  const [scope, setScope] = useState<'personal' | 'work'>('personal')
  const [categoryId, setCategoryId] = useState<string>('')

  const { data: txns, loading, error } = useTransactions({ scope, categoryId: categoryId || undefined })
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories(scope)
  const { data: parties } = useParties()

  useEffect(() => {
    if (!categoryId || categoryId === 'uncategorized') return
    if (categories.some((category) => category.id === categoryId)) return
    setCategoryId('')
  }, [categoryId, categories])

  const accountLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const account of accounts) map.set(account.id, account.name)
    return map
  }, [accounts])

  const categoryLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) map.set(category.id, category.name)
    return map
  }, [categories])

  const partyLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const party of parties) map.set(party.id, party.name)
    return map
  }, [parties])

  const byCategory = useMemo<GroupRow[]>(() => {
    const map = new Map<string, GroupRow>()
    for (const t of txns) {
      const key = t.category_id || 'uncategorized'
      const name = t.category_id ? categoryLookup.get(t.category_id) ?? 'Unknown category' : 'Uncategorized'
      if (!map.has(key)) map.set(key, { key, name, count: 0, inflow: 0, outflow: 0, net: 0 })
      const row = map.get(key)!
      row.count += 1
      if (t.direction === 'in') row.inflow += t.amount
      else if (t.direction === 'out') row.outflow += Math.abs(t.amount)
      row.net = row.inflow - row.outflow
    }
    return Array.from(map.values()).sort((a, b) => b.net - a.net)
  }, [txns, categoryLookup])

  const byAccount = useMemo<GroupRow[]>(() => {
    const map = new Map<string, GroupRow>()
    for (const t of txns) {
      const key = t.account_id
      const name = accountLookup.get(key) ?? 'Unknown account'
      if (!map.has(key)) map.set(key, { key, name, count: 0, inflow: 0, outflow: 0, net: 0 })
      const row = map.get(key)!
      row.count += 1
      if (t.direction === 'in') row.inflow += t.amount
      else if (t.direction === 'out') row.outflow += Math.abs(t.amount)
      row.net = row.inflow - row.outflow
    }
    return Array.from(map.values()).sort((a, b) => b.net - a.net)
  }, [txns, accountLookup])

  const byParty = useMemo<GroupRow[]>(() => {
    const map = new Map<string, GroupRow>()
    for (const t of txns) {
      const key = t.party_id || 'no-party'
      const name = t.party_id ? partyLookup.get(t.party_id) ?? 'Unknown party' : 'No Party'
      if (!map.has(key)) map.set(key, { key, name, count: 0, inflow: 0, outflow: 0, net: 0 })
      const row = map.get(key)!
      row.count += 1
      if (t.direction === 'in') row.inflow += t.amount
      else if (t.direction === 'out') row.outflow += Math.abs(t.amount)
      row.net = row.inflow - row.outflow
    }
    return Array.from(map.values()).sort((a, b) => b.net - a.net)
  }, [txns, partyLookup])

  const selectedCategoryName = useMemo(() => {
    if (!categoryId) return 'All categories'
    if (categoryId === 'uncategorized') return 'Uncategorized'
    return categoryLookup.get(categoryId) ?? 'Unknown category'
  }, [categoryId, categoryLookup])

  const totals = useMemo(() => {
    let inflow = 0
    let outflow = 0
    let inCount = 0
    let outCount = 0
    let topInflow = 0
    let topOutflow = 0

    for (const t of txns) {
      if (t.direction === 'in') {
        inflow += t.amount
        inCount += 1
        if (t.amount > topInflow) topInflow = t.amount
      } else if (t.direction === 'out') {
        const value = Math.abs(t.amount)
        outflow += value
        outCount += 1
        if (value > topOutflow) topOutflow = value
      }
    }

    const net = inflow - outflow
    const totalFlow = inflow + outflow
    const avgInflow = inCount ? inflow / inCount : 0
    const avgOutflow = outCount ? outflow / outCount : 0
    const avgTicket = txns.length ? totalFlow / txns.length : 0

    return { inflow, outflow, net, count: txns.length, avgInflow, avgOutflow, avgTicket, topInflow, topOutflow, totalFlow }
  }, [txns])

  const flowPieData = useMemo(() => {
    if (!totals.totalFlow) return []
    return [
      { name: 'Inflow', value: Number(totals.inflow.toFixed(2)) },
      { name: 'Outflow', value: Number(totals.outflow.toFixed(2)) },
    ]
  }, [totals])

  const trendData = useMemo(() => {
    const map = new Map<string, { date: Date; inflow: number; outflow: number; net: number }>()
    for (const t of txns) {
      const dateObj = new Date(t.date)
      if (Number.isNaN(dateObj.getTime())) continue
      const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}`
      if (!map.has(key)) {
        map.set(key, { date: new Date(dateObj.getFullYear(), dateObj.getMonth(), 1), inflow: 0, outflow: 0, net: 0 })
      }
      const bucket = map.get(key)!
      if (t.direction === 'in') bucket.inflow += t.amount
      else if (t.direction === 'out') bucket.outflow += Math.abs(t.amount)
      bucket.net = bucket.inflow - bucket.outflow
    }
    return Array.from(map.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-8)
      .map((bucket) => ({
        month: format(bucket.date, 'MMM yyyy'),
        inflow: Number(bucket.inflow.toFixed(2)),
        outflow: Number(bucket.outflow.toFixed(2)),
        net: Number(bucket.net.toFixed(2)),
      }))
  }, [txns])

  const categoryChartData = useMemo(
    () =>
      byCategory.slice(0, 6).map((row) => ({
        name: row.name,
        net: Number(row.net.toFixed(2)),
        inflow: Number(row.inflow.toFixed(2)),
        outflow: Number(row.outflow.toFixed(2)),
      })),
    [byCategory]
  )

  const topParties = useMemo(() => byParty.slice(0, 6), [byParty])
  const topParty = topParties[0]

  const marginPercent = totals.totalFlow ? clampPercent(((totals.net + totals.totalFlow) / (totals.totalFlow * 2)) * 100) : 50
  const inflowPercent = totals.totalFlow ? clampPercent((totals.inflow / totals.totalFlow) * 100) : 0
  const outflowPercent = totals.totalFlow ? clampPercent((totals.outflow / totals.totalFlow) * 100) : 0
  const topCategory = byCategory[0]
  const topCategoryPercent = topCategory
    ? clampPercent((Math.abs(topCategory.net) / (totals.totalFlow || Math.abs(topCategory.net) || 1)) * 100)
    : 0
  function exportPdf() {
    const title = `Reports - ${scope === 'personal' ? 'Personal' : 'Work'} - ${selectedCategoryName}`
    const section = (heading: string, rows: GroupRow[]) => {
      const rowsHtml = rows
        .map((row) => {
          const name = row.key === 'no-party' ? 'No Party' : row.name || 'Unknown party'
          const inflow = formatCurrency(row.inflow)
          const outflow = formatCurrency(row.outflow)
          const net = formatCurrency(row.net)
          const netClass = row.net >= 0 ? 'positive' : 'negative'
          return `
              <tr>
                <td class="label">${name}</td>
                <td class="num muted">${row.count}</td>
                <td class="num positive">${inflow}</td>
                <td class="num negative">${outflow}</td>
                <td class="num ${netClass}">${net}</td>
              </tr>`
        })
        .join('')
      return `
      <section class="block">
        <header class="block-title">${heading}</header>
        <div class="table-shell">
          <table class="grid-table">
            <thead>
              <tr>
                <th>Name</th>
                <th class="num">Count</th>
                <th class="num">Inflow</th>
                <th class="num">Outflow</th>
                <th class="num">Net</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td class="empty" colspan="5">No data yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>`
    }
    const summary = `
      <section class="summary">
        <div>
          <span>Net cash</span>
          <strong class="${totals.net >= 0 ? 'positive' : 'negative'}">${formatCurrency(totals.net)}</strong>
        </div>
        <div>
          <span>Total inflow</span>
          <strong class="positive">${formatCurrency(totals.inflow)}</strong>
        </div>
        <div>
          <span>Total outflow</span>
          <strong class="negative">${formatCurrency(totals.outflow)}</strong>
        </div>
        <div>
          <span>Transactions</span>
          <strong class="muted">${totals.count}</strong>
        </div>
      </section>`
    const header = `
      <header class="hero">
        <div class="identity">
          <div class="spark"></div>
          <div>
            <h1>Finance Tracker Reports</h1>
            <p class="muted">Scope: ${scope} | ${selectedCategoryName}</p>
          </div>
        </div>
        <span class="stamp">${new Date().toLocaleString()}</span>
      </header>`
    const html = `
      ${header}
      ${summary}
      ${section('By Category', byCategory)}
      ${section('By Account', byAccount)}
      ${section('By Party', byParty)}
    `
    const wrapper = `
      <style>
        :root { font-family: 'Inter', Arial, sans-serif; color: #0f172a; }
        body { margin: 0; padding: 48px; background: #e2e8f0; }
        main { max-width: 940px; margin: 0 auto; background: #ffffff; border-radius: 28px; padding: 36px; box-shadow: 0 32px 70px rgba(15, 23, 42, 0.16); }
        .hero { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 28px; }
        .identity { display: flex; align-items: center; gap: 16px; }
        .spark { width: 16px; height: 16px; border-radius: 999px; background: linear-gradient(135deg, #38bdf8, #6366f1); box-shadow: 0 0 18px rgba(99, 102, 241, 0.45); }
        .hero h1 { margin: 0; font-size: 22px; letter-spacing: -0.01em; }
        .muted { margin: 4px 0 0; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; }
        .stamp { font-size: 12px; font-weight: 600; padding: 6px 16px; border-radius: 999px; background: #f1f5f9; color: #0f172a; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin-bottom: 30px; }
        .summary div { padding: 14px 16px; border-radius: 18px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(14, 165, 233, 0.05)); border: 1px solid rgba(148, 163, 184, 0.25); backdrop-filter: blur(12px); }
        .summary span { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #475569; }
        .summary strong { display: block; margin-top: 6px; font-size: 20px; letter-spacing: -0.01em; }
        .summary .positive { color: #047857; }
        .summary .negative { color: #b91c1c; }
        .summary .muted { color: #334155; font-size: 18px; }
        .block { margin-bottom: 28px; }
        .block-title { font-size: 13px; letter-spacing: 0.22em; text-transform: uppercase; color: #1e293b; margin-bottom: 14px; font-weight: 700; }
        .table-shell { border-radius: 20px; overflow: hidden; border: 1px solid rgba(148, 163, 184, 0.25); box-shadow: 0 16px 38px rgba(15, 23, 42, 0.1); }
        .grid-table { width: 100%; border-collapse: collapse; font-size: 11px; background: #ffffff; }
        .grid-table thead tr { background: linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(99, 102, 241, 0.12)); color: #1e1b4b; }
        .grid-table th { padding: 10px 16px; text-align: left; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
        .grid-table th.num { text-align: right; }
        .grid-table td { padding: 9px 16px; border-top: 1px solid rgba(148, 163, 184, 0.15); color: #334155; }
        .grid-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
        .grid-table td.label { font-weight: 600; }
        .grid-table td.positive { color: #047857; font-weight: 600; }
        .grid-table td.negative { color: #b91c1c; font-weight: 600; }
        .grid-table td.muted { color: #64748b; }
        .grid-table tr:nth-child(even) td { background: rgba(248, 250, 252, 0.7); }
        .grid-table tr:hover td { background: rgba(226, 232, 240, 0.7); }
        .grid-table td.empty { text-align: center; padding: 18px 12px; color: #94a3b8; font-size: 11px; font-style: italic; }
      </style>
      <main>${html}</main>
    `
    printHtml(title, wrapper)
  }  function exportExcel() {
    const table = (heading: string, rows: GroupRow[]) => {
      const rowsHtml = rows
        .map((row) => {
          const name = row.key === 'no-party' ? 'No Party' : row.name || 'Unknown party'
          const netClass = row.net >= 0 ? 'positive' : 'negative'
          return `
            <tr>
              <td>${name}</td>
              <td class="num muted">${row.count}</td>
              <td class="num positive">${formatCurrency(row.inflow)}</td>
              <td class="num negative">${formatCurrency(row.outflow)}</td>
              <td class="num ${netClass}">${formatCurrency(row.net)}</td>
            </tr>`
        })
        .join('')
      return `
        <h2 class="xlsx-heading">${heading}</h2>
        <table class="xlsx-table">
          <thead>
            <tr>
              <th>Name</th>
              <th class="num">Count</th>
              <th class="num">Inflow</th>
              <th class="num">Outflow</th>
              <th class="num">Net</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td class="empty" colspan="5">No data yet</td></tr>'}
          </tbody>
        </table>`
    }

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Reports - ${scope} - ${selectedCategoryName}</title>
    <style>
      body { font-family: 'Inter', Arial, sans-serif; color: #0f172a; background: #f1f5f9; margin: 0; padding: 32px; }
      main { max-width: 960px; margin: 0 auto; background: #ffffff; border-radius: 22px; padding: 28px 32px; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.14); }
      h1 { font-size: 20px; margin: 0 0 18px; letter-spacing: -0.01em; }
      .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
      .summary div { padding: 12px 16px; border-radius: 16px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(14, 165, 233, 0.06)); border: 1px solid rgba(148, 163, 184, 0.25); }
      .summary span { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #475569; }
      .summary strong { display: block; margin-top: 6px; font-size: 18px; }
      .summary strong.positive { color: #047857; }
      .summary strong.negative { color: #b91c1c; }
      .summary strong.muted { color: #334155; font-size: 16px; }
      .xlsx-heading { margin: 22px 0 8px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #475569; }
      .xlsx-table { border-collapse: collapse; width: 100%; font-size: 12px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06); }
      .xlsx-table thead tr { background: linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(14, 165, 233, 0.2)); color: #1e1b4b; }
      .xlsx-table th { padding: 10px 14px; text-align: left; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; border-bottom: 1px solid rgba(148, 163, 184, 0.22); }
      .xlsx-table th.num { text-align: right; }
      .xlsx-table td { padding: 9px 14px; border-bottom: 1px solid rgba(148, 163, 184, 0.15); color: #334155; }
      .xlsx-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
      .xlsx-table td.positive { color: #047857; font-weight: 600; }
      .xlsx-table td.negative { color: #b91c1c; font-weight: 600; }
      .xlsx-table td.muted { color: #64748b; }
      .xlsx-table tr:nth-child(even) td { background: rgba(248, 250, 252, 0.7); }
      .empty { text-align: center; padding: 18px 12px; color: #94a3b8; font-style: italic; }
    </style>
  </head>
  <body>
    <main>
      <h1>Reports - ${scope} - ${selectedCategoryName}</h1>
      <section class="summary">
        <div><span>Net cash</span><strong class="${totals.net >= 0 ? 'positive' : 'negative'}">${formatCurrency(totals.net)}</strong></div>
        <div><span>Total inflow</span><strong class="positive">${formatCurrency(totals.inflow)}</strong></div>
        <div><span>Total outflow</span><strong class="negative">${formatCurrency(totals.outflow)}</strong></div>
        <div><span>Transactions</span><strong class="muted">${totals.count}</strong></div>
      </section>
      ${table('By Category', byCategory)}
      ${table('By Account', byAccount)}
      ${table('By Party', byParty)}
    </main>
  </body>
</html>`
    download(
      `reports_${scope}_${new Date().toISOString().slice(0, 10)}.xls`,
      html,
      'application/vnd.ms-excel;charset=utf-8'
    )
  }
  return (
    <div className="space-y-6 pb-10">
      <div className="overflow-hidden rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100 shadow-lg">
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/90">
              <IconReports size={16} />
              Smart Reports
            </span>
            <h1 className="text-2xl font-semibold md:text-3xl">Insightful reports for every decision</h1>
            <p className="text-sm text-slate-300 md:text-base">
              Explore detailed inflow and outflow trends, compare accounts and stakeholders, and export polished summaries for your records.
            </p>
            <p className="text-xs uppercase tracking-wider text-slate-400">
              Viewing scope: {scope} | {selectedCategoryName}
            </p>
          </div>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white/5 p-4 backdrop-blur-md">
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Scope</span>
              <div className="flex gap-2">
                              <Button
                size="sm"
                variant={scope === 'personal' ? 'default' : 'outline'}
                className={scope === 'personal' ? 'bg-white text-slate-900 hover:bg-white/90 shadow-md' : 'border-white/30 text-white/80 hover:text-white'}
                onClick={() => setScope('personal')}
              >
                Personal
              </Button>
                              <Button
                size="sm"
                variant={scope === 'work' ? 'default' : 'outline'}
                className={scope === 'work' ? 'bg-white text-slate-900 hover:bg-white/90 shadow-md' : 'border-white/30 text-white/80 hover:text-white'}
                onClick={() => setScope('work')}
              >
                Work
              </Button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">Category filter</label>
              <select
                className="h-9 w-full rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white outline-none focus:border-white/50"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">All categories</option>
                <option value="uncategorized">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" variant="secondary" size="sm" onClick={exportExcel}>
                <IconExport size={16} className="mr-2" />
                Export Excel
              </Button>
              <Button className="flex-1" size="sm" onClick={exportPdf}>
                <IconExport size={16} className="mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="text-sm text-muted-foreground">Loading reports...</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Net Cash Position"
          value={formatCurrency(totals.net)}
          subtitle={`${totals.count} transactions captured`}
          percent={marginPercent}
          icon={<IconReports size={18} />}
          accent="#6366F1"
        />
        <StatCard
          title="Total Inflow"
          value={formatCurrency(totals.inflow)}
          subtitle={`Avg ${formatCurrency(totals.avgInflow || 0)} per inflow`}
          percent={inflowPercent}
          icon={<IconTransactions size={18} />}
          accent={FLOW_COLORS.inflow}
        />
        <StatCard
          title="Total Outflow"
          value={formatCurrency(totals.outflow)}
          subtitle={`Avg ${formatCurrency(totals.avgOutflow || 0)} per outflow`}
          percent={outflowPercent}
          icon={<IconAccounts size={18} />}
          accent={FLOW_COLORS.outflow}
        />
        <StatCard
          title="Top Category"
          value={topCategory ? formatCurrency(topCategory.net) : formatCurrency(0)}
          subtitle={topCategory ? topCategory.name : 'No category performance yet'}
          percent={topCategoryPercent}
          icon={<IconCategories size={18} />}
          accent="#8B5CF6"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-col gap-1 pb-0">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <IconTransactions size={18} className="text-primary" />
              Cash flow trend
            </CardTitle>
            <p className="text-xs text-muted-foreground">Monthly inflow, outflow, and net position for the last eight periods.</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[340px] w-full">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="flowIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={FLOW_COLORS.inflow} stopOpacity={0.7} />
                        <stop offset="95%" stopColor={FLOW_COLORS.inflow} stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="flowOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={FLOW_COLORS.outflow} stopOpacity={0.7} />
                        <stop offset="95%" stopColor={FLOW_COLORS.outflow} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#CBD5F5" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) =>
                        formatCurrency(typeof value === 'number' ? value : Number(value)).replace(/\.\d+$/, '')
                      }
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(148, 163, 184, 0.16)' }}
                      formatter={(value: any, name: string) => [
                        formatCurrency(typeof value === 'number' ? value : Number(value)),
                        name === 'inflow' ? 'Inflow' : name === 'outflow' ? 'Outflow' : 'Net',
                      ]}
                    />
                    <Area type="monotone" dataKey="inflow" stroke={FLOW_COLORS.inflow} fill="url(#flowIn)" strokeWidth={2} />
                    <Area type="monotone" dataKey="outflow" stroke={FLOW_COLORS.outflow} fill="url(#flowOut)" strokeWidth={2} />
                    <Line type="monotone" dataKey="net" stroke={FLOW_COLORS.net} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 text-sm text-muted-foreground">
                  Not enough data to visualize trend.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-col gap-1 pb-0">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <IconReports size={18} className="text-primary" />
              Inflow vs Outflow
            </CardTitle>
            <p className="text-xs text-muted-foreground">Share of total cash movement in the selected scope.</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[340px] w-full">
              {flowPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={flowPieData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={6}>
                      {flowPieData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(typeof value === 'number' ? value : Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 text-sm text-muted-foreground">
                  No cash movement recorded yet.
                </div>
              )}
            </div>
            {topParty && (
              <div className="mt-4 rounded-xl border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top party</div>
                  <div className="text-xs text-muted-foreground">Net impact</div>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-medium text-foreground">{topParty.key === 'no-party' ? 'No Party' : topParty.name}</span>
                  <span className={topParty.net >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                    {formatCurrency(topParty.net)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-1 pb-0">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <IconCategories size={18} className="text-primary" />
              Category performance
            </CardTitle>
            <p className="text-xs text-muted-foreground">Top categories ranked by net balance.</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[320px] w-full">
              {categoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) =>
                        formatCurrency(typeof value === 'number' ? value : Number(value)).replace(/\.\d+$/, '')
                      }
                    />
                    <Tooltip formatter={(value: any) => formatCurrency(typeof value === 'number' ? value : Number(value))} />
                    <Bar dataKey="net" radius={[8, 8, 0, 0]}>
                      {categoryChartData.map((entry, index) => (
                        <Cell key={entry.name} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 text-sm text-muted-foreground">
                  Add transactions to see category performance.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-col gap-1 pb-0">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <IconParties size={18} className="text-primary" />
              Partner impact
            </CardTitle>
            <p className="text-xs text-muted-foreground">Highest contributing customers or vendors.</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-hidden rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Party</th>
                    <th className="px-3 py-2 text-right">Transactions</th>
                    <th className="px-3 py-2 text-right">Inflow</th>
                    <th className="px-3 py-2 text-right">Outflow</th>
                    <th className="px-3 py-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {topParties.map((partyRow) => (
                    <tr key={partyRow.key} className="border-t border-muted/40 bg-background/60 hover:bg-muted/40">
                      <td className="px-3 py-2 font-medium">{partyRow.key === 'no-party' ? 'No Party' : partyRow.name}</td>
                      <td className="px-3 py-2 text-right">{partyRow.count}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{formatCurrency(partyRow.inflow)}</td>
                      <td className="px-3 py-2 text-right text-rose-600">{formatCurrency(partyRow.outflow)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${partyRow.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(partyRow.net)}
                      </td>
                    </tr>
                  ))}
                  {topParties.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                        No party level data yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-1 pb-0">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <IconCategories size={18} className="text-primary" />
              Detailed categories
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-hidden rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-right">Transactions</th>
                    <th className="px-3 py-2 text-right">Inflow</th>
                    <th className="px-3 py-2 text-right">Outflow</th>
                    <th className="px-3 py-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((row) => (
                    <tr key={row.key} className="border-t border-muted/40 bg-background/60 hover:bg-muted/40">
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2 text-right">{row.count}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{formatCurrency(row.inflow)}</td>
                      <td className="px-3 py-2 text-right text-rose-600">{formatCurrency(row.outflow)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${row.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(row.net)}
                      </td>
                    </tr>
                  ))}
                  {byCategory.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                        No category data yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-col gap-1 pb-0">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <IconAccounts size={18} className="text-primary" />
              Detailed accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-hidden rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Account</th>
                    <th className="px-3 py-2 text-right">Transactions</th>
                    <th className="px-3 py-2 text-right">Inflow</th>
                    <th className="px-3 py-2 text-right">Outflow</th>
                    <th className="px-3 py-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {byAccount.map((row) => (
                    <tr key={row.key} className="border-t border-muted/40 bg-background/60 hover:bg-muted/40">
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2 text-right">{row.count}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{formatCurrency(row.inflow)}</td>
                      <td className="px-3 py-2 text-right text-rose-600">{formatCurrency(row.outflow)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${row.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(row.net)}
                      </td>
                    </tr>
                  ))}
                  {byAccount.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                        No account data yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-1 pb-0">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <IconParties size={18} className="text-primary" />
              Detailed parties
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-hidden rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Party</th>
                    <th className="px-3 py-2 text-right">Transactions</th>
                    <th className="px-3 py-2 text-right">Inflow</th>
                    <th className="px-3 py-2 text-right">Outflow</th>
                    <th className="px-3 py-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {byParty.map((row) => (
                    <tr key={row.key} className="border-t border-muted/40 bg-background/60 hover:bg-muted/40">
                      <td className="px-3 py-2 font-medium">{row.key === 'no-party' ? 'No Party' : row.name || 'Unknown party'}</td>
                      <td className="px-3 py-2 text-right">{row.count}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{formatCurrency(row.inflow)}</td>
                      <td className="px-3 py-2 text-right text-rose-600">{formatCurrency(row.outflow)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${row.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(row.net)}
                      </td>
                    </tr>
                  ))}
                  {byParty.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                        No party data yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
