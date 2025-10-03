
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ArrowRight, Filter } from 'lucide-react'
import TransferForm from '../features/transfers/TransferForm'
import { useTransfers } from '../hooks/useTransfers'
import { useAccounts } from '../hooks/useAccounts'
import { formatCurrency } from '../lib/format'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

type StatusTone = 'sent' | 'received'

const badgeTone: Record<StatusTone, string> = {
  sent: 'text-rose-600 border border-rose-200 bg-rose-50',
  received: 'text-emerald-600 border border-emerald-200 bg-emerald-50',
}

function formatDate(value: Date | string) {
  try {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
  } catch {
    return String(value)
  }
}

export default function TransfersPage() {
  const [fromAccount, setFromAccount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const { data: transfers, error, loading, refetch } = useTransfers({
    fromAccount: fromAccount || undefined,
    toAccount: toAccount || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    search: search || undefined,
  })
  const { data: accounts } = useAccounts()

  const accountLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const account of accounts) map.set(account.id, account.name)
    return map
  }, [accounts])

  const stats = useMemo(() => {
    const totalVolume = transfers.reduce((sum, transfer) => sum + transfer.amount, 0)
    return {
      totalVolume,
      count: transfers.length,
    }
  }, [transfers])

  function clearFilters() {
    setFromAccount('')
    setToAccount('')
    setFromDate('')
    setToDate('')
    setSearch('')
  }

  function toneBadge(label: string, tone: StatusTone) {
    return (
      <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', badgeTone[tone])}>
        {label}
      </span>
    )
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('transfers').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Transfer deleted')
    refetch()
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Transfers</h1>
        <p className="text-sm text-muted-foreground">Move balances between accounts and review the transfer trail.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white/90">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stats.count}</p>
            <p className="text-xs text-muted-foreground">Total recorded</p>
          </CardContent>
        </Card>
        <Card className="bg-white/90">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(stats.totalVolume)}</p>
            <p className="text-xs text-muted-foreground">Sum of all transfers</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/95">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Create Transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <TransferForm onCreated={refetch} />
        </CardContent>
      </Card>

      <Card className="bg-white/95">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">History</CardTitle>
            <p className="text-sm text-muted-foreground">Filter and audit recent transfers.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={showFilters ? 'secondary' : 'outline'}
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
              aria-controls="transfer-filters"
            >
              <Filter size={16} />
              Filters
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showFilters && (
            <div id="transfer-filters" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">From account</label>
                <select className="h-10 rounded-md border border-input bg-white px-3 text-sm" value={fromAccount} onChange={(event) => setFromAccount(event.target.value)}>
                  <option value="">All</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">To account</label>
                <select className="h-10 rounded-md border border-input bg-white px-3 text-sm" value={toAccount} onChange={(event) => setToAccount(event.target.value)}>
                  <option value="">All</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">From date</label>
                <Input type="date" className="h-10" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">To date</label>
                <Input type="date" className="h-10" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Notes</label>
                <Input placeholder="Search notes" className="h-10" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <div className="sm:col-span-2 lg:col-span-5 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
              </div>
            </div>
          )}

          {error && <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">{error}</div>}

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Movement</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-left">Notes</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>Loading transfers...</td>
                  </tr>
                )}
                {!loading && transfers.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>No transfers found for the selected filters.</td>
                  </tr>
                )}
                {!loading && transfers.map((transfer) => (
                  <tr key={transfer.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{formatDate(transfer.date)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {toneBadge('Sent', 'sent')}
                          <span className="font-medium">{accountLookup.get(transfer.from_account) || 'Account'}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <ArrowRight size={14} className="text-muted-foreground" />
                          {toneBadge('Received', 'received')}
                          <span className="font-medium text-foreground">{accountLookup.get(transfer.to_account) || 'Account'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(transfer.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{transfer.notes || 'N/A'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => handleDelete(transfer.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
