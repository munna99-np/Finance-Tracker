import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useDashboard } from '../features/dashboard/useDashboard'
import { formatCurrency } from '../lib/format'
import { IconAccounts, IconTransactions } from '../components/icons'
import CashflowLineChart from '../features/dashboard/CashflowLineChart'
import InventoryPie from '../features/dashboard/InventoryPie'
import { KPICard } from '../components/ui/kpi'

export default function DashboardPage() {
  const { data, loading, error } = useDashboard()
  const di = data?.totalIncome ?? 0
  const de = data?.totalExpense ?? 0
  const dn = data?.net ?? 0
  const accs = data?.accounts ?? []

  return (
    <div className="space-y-3">
      {loading && <div className="text-sm text-muted-foreground">Loading dashboard...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
        <KPICard title="Total Income" value={formatCurrency(di)} delta={'+'} positive icon={<IconTransactions size={16} />} />
        <KPICard title="Total Expenses" value={formatCurrency(de)} delta={'-'} positive={false} icon={<IconTransactions size={16} className="rotate-180" />} />
        <KPICard title="Net" value={formatCurrency(dn)} icon={<IconTransactions size={16} />} />
      {/* Accounts card moved below charts as a table */}
      <div className="sm:col-span-2 lg:col-span-2">
        <Card className="h-full">
          <CardHeader className="p-4">
            <CardTitle className="flex items-center gap-2">
              <IconTransactions size={18} className="text-primary" /> Cashflow
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 min-h-[300px]">
            <CashflowLineChart />
          </CardContent>
        </Card>
      </div>
      <div className="sm:col-span-2 lg:col-span-2">
        <Card className="h-full">
          <CardHeader className="p-4">
            <CardTitle className="flex items-center gap-2">
              <IconTransactions size={18} className="text-primary" /> Inventory Stock by Item
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 min-h-[300px]">
            <InventoryPie />
          </CardContent>
        </Card>
      </div>
      {/* Accounts Table (full width below charts) */}
      <div className="sm:col-span-2 lg:col-span-4">
        <Card className="h-full">
          <CardHeader className="p-4">
            <CardTitle className="flex items-center gap-2">
              <IconAccounts size={18} className="text-primary" /> Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="overflow-x-auto border rounded-md">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-left w-12">SN</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Kind</th>
                    <th className="p-2 text-right">Opening</th>
                    <th className="p-2 text-right">Balance</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {accs.map(({ account, balance }, idx) => (
                    <tr key={account.id} className="border-t hover:bg-muted/30">
                      <td className="p-2">{idx + 1}</td>
                      <td className="p-2 font-medium">{account.name}</td>
                      <td className="p-2 capitalize">{account.kind}</td>
                      <td className="p-2 text-right">{formatCurrency(account.opening_balance)}</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(balance)}</td>
                      <td className="p-2">{account.is_active ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))}
                  {accs.length === 0 && (
                    <tr>
                      <td className="p-2 text-muted-foreground" colSpan={6}>No accounts yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
