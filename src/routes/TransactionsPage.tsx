import { useState } from 'react'
import { useTransactions } from '../hooks/useTransactions'
import TransactionForm from '../features/transactions/TransactionForm'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../lib/format'
import { Button } from '../components/ui/button'
import { IconExport } from '../components/icons'
import { download, toCsv } from '../lib/csv'

export default function TransactionsPage() {
  const [scope, setScope] = useState<'' | 'personal' | 'work'>('')
  const { data, error, refetch } = useTransactions({ scope: scope || undefined })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Transactions</h1>
        <p className="text-sm text-muted-foreground">Add and review your records.</p>
      </div>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Scope:</span>
          <Button size="sm" variant={scope === 'personal' ? 'default' : 'outline'} onClick={() => setScope('personal')}>Personal</Button>
          <Button size="sm" variant={scope === 'work' ? 'default' : 'outline'} onClick={() => setScope('work')}>Work</Button>
          <Button size="sm" variant={scope === '' ? 'default' : 'outline'} onClick={() => setScope('')}>All</Button>
        </div>
        <Button asChild>
          <Link to="/transfers">Add Transfer</Link>
        </Button>
      </div>
      <TransactionForm onCreated={refetch} />
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => {
            const headers = ['date', 'direction', 'scope', 'qty', 'amount', 'notes']
            const csv = toCsv(
              data.map((t) => ({ ...t, date: t.date })),
              headers
            )
            download('transactions.csv', csv)
          }}
        >
          <IconExport className="mr-2" size={16} /> Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Direction</th>
              <th className="text-left p-2">Scope</th>
              <th className="text-right p-2">Amount</th>
              <th className="text-left p-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {data.map((t) => (
              <tr key={t.id} className="border-t hover:bg-muted/30">
                <td className="p-2">{t.date instanceof Date ? t.date.toISOString().slice(0,10) : String(t.date)}</td>
                <td className="p-2">{t.direction}</td>
                <td className="p-2">{t.scope}</td>
                <td className="p-2 text-right">{formatCurrency(t.amount)}</td>
                <td className="p-2">{t.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
