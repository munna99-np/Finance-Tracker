import { useMemo, useState } from 'react'
import { IconReports } from '../components/icons'
import { Button } from '../components/ui/button'
import { useTransactions } from '../hooks/useTransactions'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { useParties } from '../hooks/useParties'
import { formatCurrency } from '../lib/format'
import { printHtml } from '../lib/print'
import { download } from '../lib/csv'

type GroupRow = { key: string; name: string; count: number; inflow: number; outflow: number; net: number }

export default function ReportsPage() {
  const [scope, setScope] = useState<'personal' | 'work'>('personal')
  const [categoryId, setCategoryId] = useState<string>('')

  // Fetch all data (no date range); filter by scope and optional category
  const { data: txns, error } = useTransactions({ scope, categoryId: categoryId || undefined })
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories(scope)
  const { data: parties } = useParties()

  const byCategory = useMemo<GroupRow[]>(() => {
    const map = new Map<string, GroupRow>()
    for (const t of txns) {
      const key = t.category_id || 'uncategorized'
      const name = t.category_id ? categories.find((c) => c.id === t.category_id)?.name ?? 'Unknown' : 'Uncategorized'
      if (!map.has(key)) map.set(key, { key, name, count: 0, inflow: 0, outflow: 0, net: 0 })
      const row = map.get(key)!
      row.count += 1
      if (t.direction === 'in') row.inflow += t.amount
      else if (t.direction === 'out') row.outflow += Math.abs(t.amount)
      row.net = row.inflow - row.outflow
    }
    return Array.from(map.values()).sort((a, b) => b.net - a.net)
  }, [txns, categories])

  const byAccount = useMemo<GroupRow[]>(() => {
    const map = new Map<string, GroupRow>()
    for (const t of txns) {
      const key = t.account_id
      const name = accounts.find((a) => a.id === key)?.name ?? 'Unknown'
      if (!map.has(key)) map.set(key, { key, name, count: 0, inflow: 0, outflow: 0, net: 0 })
      const row = map.get(key)!
      row.count += 1
      if (t.direction === 'in') row.inflow += t.amount
      else if (t.direction === 'out') row.outflow += Math.abs(t.amount)
      row.net = row.inflow - row.outflow
    }
    return Array.from(map.values()).sort((a, b) => b.net - a.net)
  }, [txns, accounts])

  const byParty = useMemo<GroupRow[]>(() => {
    const map = new Map<string, GroupRow>()
    for (const t of txns) {
      const key = t.party_id || 'no-party'
      const name = t.party_id ? (parties.find((p) => p.id === t.party_id)?.name ?? 'Unknown') : '—'
      if (!map.has(key)) map.set(key, { key, name, count: 0, inflow: 0, outflow: 0, net: 0 })
      const row = map.get(key)!
      row.count += 1
      if (t.direction === 'in') row.inflow += t.amount
      else if (t.direction === 'out') row.outflow += Math.abs(t.amount)
      row.net = row.inflow - row.outflow
    }
    return Array.from(map.values()).sort((a, b) => b.net - a.net)
  }, [txns, parties])

  const selectedCategoryName = useMemo(() => {
    if (!categoryId) return 'All categories'
    return categories.find((c) => c.id === categoryId)?.name || 'Unknown category'
  }, [categoryId, categories])

  function exportPdf() {
    const title = `Reports — ${scope === 'personal' ? 'Personal' : 'Work'} — ${selectedCategoryName}`
    const section = (heading: string, rows: GroupRow[]) => `
      <div class="card">
        <div class="card-title">${heading}</div>
        <table>
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
            ${rows
              .map(
                (r) => `
                  <tr>
                    <td>${r.key === 'no-party' ? 'No Party' : r.name}</td>
                    <td class=\"num\">${r.count}</td>
                    <td class=\"num\">${formatCurrency(r.inflow)}</td>
                    <td class=\"num\">${formatCurrency(r.outflow)}</td>
                    <td class=\"num\"><strong>${formatCurrency(r.net)}</strong></td>
                  </tr>`
              )
              .join('')}
            ${rows.length === 0 ? `<tr><td class=\"muted\" colspan=\"5\">No data</td></tr>` : ''}
          </tbody>
        </table>
      </div>`

    const header = `
      <div class=\"header\">
        <div class=\"brand\">
          <div style=\"width:10px;height:10px;border-radius:999px;background:var(--primary)\"></div>
          <div>
            <h1>Finance Tracker — Reports</h1>
            <div class=\"muted\">Scope: ${scope} • ${selectedCategoryName}</div>
          </div>
        </div>
        <div class=\"badge\">${new Date().toLocaleString()}</div>
      </div>`

    const html = `
      ${header}
      ${section('By Category', byCategory)}
      ${section('By Account', byAccount)}
      ${section('By Party', byParty)}
    `
    printHtml(title, html)
  }

  function exportExcel() {
    const table = (heading: string, rows: GroupRow[]) => `
      <h2>${heading}</h2>
      <table border=\"1\" cellspacing=\"0\" cellpadding=\"4\">
        <thead>
          <tr>
            <th align=\"left\">Name</th>
            <th align=\"right\">Count</th>
            <th align=\"right\">Inflow</th>
            <th align=\"right\">Outflow</th>
            <th align=\"right\">Net</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
                <tr>
                  <td>${r.key === 'no-party' ? 'No Party' : r.name}</td>
                  <td align=\"right\">${r.count}</td>
                  <td align=\"right\">${r.inflow}</td>
                  <td align=\"right\">${r.outflow}</td>
                  <td align=\"right\">${r.net}</td>
                </tr>`
            )
            .join('')}
          ${rows.length === 0 ? `<tr><td colspan=\"5\">No data</td></tr>` : ''}
        </tbody>
      </table>`

    const html = `<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Reports</title><style>:root{--primary:#1e3a8a;--ink:#0f172a;--muted:#64748b;--border:#dfe3e8;--row:#f8fafc}body{font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--ink)}.xlsx-heading{margin:14px 0 6px;font-size:12pt;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}.xlsx-table{border-collapse:separate;border-spacing:0;width:100%;font-size:11pt}.xlsx-table thead th{background:var(--primary);color:#fff;text-align:left;font-weight:600;padding:8pt 10pt;border-right:1px solid rgba(255,255,255,.25)}.xlsx-table thead th:last-child{border-right:none}.xlsx-table tbody td{border-top:1px solid var(--border);padding:7pt 10pt}.xlsx-table tbody tr:nth-child(even){background:var(--row)}.xlsx-table .num{text-align:right}h1{font-size:14pt;margin:0 0 8pt}</style></head><body>
      <h1>Reports — ${scope} — ${selectedCategoryName}</h1>
      ${table('By Category', byCategory)}
      <br/>
      ${table('By Account', byAccount)}
      <br/>
      ${table('By Party', byParty)}
    </body></html>`

    download(
      `reports_${scope}_${new Date().toISOString().slice(0, 10)}.xls`,
      html,
      'application/vnd.ms-excel;charset=utf-8'
    )
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <IconReports size={18} className="text-primary" /> Reports
        </h1>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-sm">Category</label>
            <select className="h-9 w-48 border rounded-md px-2" value={categoryId as any} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="w-40">
            <label className="text-sm">Scope</label>
            <div className="flex gap-2">
              <Button size="sm" variant={scope === 'personal' ? 'default' : 'outline'} onClick={() => setScope('personal')}>Personal</Button>
              <Button size="sm" variant={scope === 'work' ? 'default' : 'outline'} onClick={() => setScope('work')}>Work</Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportExcel}>Export Excel</Button>
            <Button size="sm" onClick={exportPdf}>Export PDF</Button>
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-md overflow-hidden">
          <div className="px-3 py-2 font-medium bg-muted/50">By Category</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[15px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Category</th>
                  <th className="text-right p-2">Count</th>
                  <th className="text-right p-2">Inflow</th>
                  <th className="text-right p-2">Outflow</th>
                  <th className="text-right p-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((r) => (
                  <tr key={r.key} className="border-t hover:bg-muted/30">
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-right">{r.count}</td>
                    <td className="p-2 text-right">{formatCurrency(r.inflow)}</td>
                    <td className="p-2 text-right">{formatCurrency(r.outflow)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(r.net)}</td>
                  </tr>
                ))}
                {byCategory.length === 0 && (
                  <tr>
                    <td className="p-2 text-muted-foreground" colSpan={5}>No data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="border rounded-md overflow-hidden">
          <div className="px-3 py-2 font-medium bg-muted/50">By Account</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[15px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Account</th>
                  <th className="text-right p-2">Count</th>
                  <th className="text-right p-2">Inflow</th>
                  <th className="text-right p-2">Outflow</th>
                  <th className="text-right p-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {byAccount.map((r) => (
                  <tr key={r.key} className="border-t hover:bg-muted/30">
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-right">{r.count}</td>
                    <td className="p-2 text-right">{formatCurrency(r.inflow)}</td>
                    <td className="p-2 text-right">{formatCurrency(r.outflow)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(r.net)}</td>
                  </tr>
                ))}
                {byAccount.length === 0 && (
                  <tr>
                    <td className="p-2 text-muted-foreground" colSpan={5}>No data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="border rounded-md overflow-hidden md:col-span-2">
          <div className="px-3 py-2 font-medium bg-muted/50">By Party</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[15px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Party</th>
                  <th className="text-right p-2">Count</th>
                  <th className="text-right p-2">Inflow</th>
                  <th className="text-right p-2">Outflow</th>
                  <th className="text-right p-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {byParty.map((r) => (
                  <tr key={r.key} className="border-t hover:bg-muted/30">
                    <td className="p-2">{r.key === 'no-party' ? 'No Party' : r.name}</td>
                    <td className="p-2 text-right">{r.count}</td>
                    <td className="p-2 text-right">{formatCurrency(r.inflow)}</td>
                    <td className="p-2 text-right">{formatCurrency(r.outflow)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(r.net)}</td>
                  </tr>
                ))}
                {byParty.length === 0 && (
                  <tr>
                    <td className="p-2 text-muted-foreground" colSpan={5}>No data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
