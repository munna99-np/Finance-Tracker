import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useDashboard } from '../features/dashboard/useDashboard'
import { formatCurrency } from '../lib/format'
import { IconAccounts, IconTransactions, IconDashboard } from '../components/icons'
import CashflowLineChart from '../features/dashboard/CashflowLineChart'
import MonthlyBarChart from '../features/dashboard/MonthlyBarChart'
import DailySalesDonut from '../features/dashboard/DailySalesDonut'
import { StatCard } from '../components/ui/stat-card'
import PartiesList from '../features/dashboard/PartiesList'

export default function DashboardPage() {
  const { data, loading, error } = useDashboard()
  const di = data?.totalIncome ?? 0
  const de = data?.totalExpense ?? 0
  // const dn = data?.net ?? 0
  const accs = data?.accounts ?? []

  return (
    <div className="space-y-4">
      {loading && <div className="text-sm text-muted-foreground">Loading dashboard...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {/* Top stats like the reference UI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
        <StatCard title="Total Revenue" value={formatCurrency(di)} subtitle="Revenue today" percent={58} icon={<IconDashboard size={18} />} accent="#22C55E" />
        <StatCard title="Sales Analytics" value={formatCurrency(di - de)} subtitle="Revenue today" percent={87} icon={<IconTransactions size={18} />} accent="#8B5CF6" />
        <StatCard title="Statistics" value={formatCurrency(di)} subtitle="Revenue today" percent={80} icon={<IconTransactions size={18} />} accent="#3B82F6" />
        <StatCard title="Daily Sales" value={formatCurrency(di / 30)} subtitle="Revenue today" percent={65} icon={<IconTransactions size={18} />} accent="#F59E0B" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="h-full">
          <CardHeader className="p-4">
            <CardTitle className="flex items-center gap-2">
              <IconTransactions size={18} className="text-primary" /> Daily Sales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 min-h-[300px]">
            <DailySalesDonut />
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="p-4">
            <CardTitle className="flex items-center gap-2">
              <IconTransactions size={18} className="text-primary" /> Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 min-h-[300px]">
            <MonthlyBarChart />
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="p-4">
            <CardTitle className="flex items-center gap-2">
              <IconTransactions size={18} className="text-primary" /> Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 min-h-[300px]">
            <CashflowLineChart />
          </CardContent>
        </Card>
      </div>

      {/* Parties list instead of team */}
      <PartiesList />

      {/* Accounts Table */}
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
  )
}
