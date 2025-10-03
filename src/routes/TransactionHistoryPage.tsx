import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { formatCurrency } from '../lib/format'
import { useAccounts } from '../hooks/useAccounts'
import { useTransactions } from '../hooks/useTransactions'

type DirectionSegment = 'all' | 'in' | 'out' | 'transfer'

function formatDate(value: Date | string) {
  try {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
  } catch {
    return String(value)
  }
}

const directionLabels: Record<Exclude<DirectionSegment, 'all'>, string> = {
  in: 'Received',
  out: 'Payment',
  transfer: 'Transfer',
}

export default function TransactionHistoryPage() {
  const [direction, setDirection] = useState<DirectionSegment>('all')
  const [accountId, setAccountId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')

  const { data: accounts } = useAccounts()

  const accountLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const account of accounts) map.set(account.id, account.name)
    return map
  }, [accounts])

  useEffect(() => {
    if (!accountId) return
    if (!accounts.some((acc) => acc.id === accountId)) setAccountId('')
  }, [accountId, accounts])

  const filters = useMemo(() => ({
    accountId: accountId || undefined,
    direction: direction === 'all' ? undefined : direction,
    from: from || undefined,
    to: to || undefined,
    search: search || undefined,
  }), [accountId, direction, from, to, search])

  const { data, loading, error, refetch } = useTransactions(filters)

  const totals = useMemo(() => {
    let incoming = 0
    let outgoing = 0
    for (const tx of data) {
      if (tx.direction === 'in') incoming += tx.amount
      else if (tx.direction === 'out') outgoing += Math.abs(tx.amount)
    }
    const net = data.reduce((sum, tx) => sum + tx.amount, 0)
    const opening = accountId
      ? accounts.find((acc) => acc.id === accountId)?.opening_balance ?? 0
      : accounts.reduce((sum, acc) => sum + acc.opening_balance, 0)
    const balance = opening + net
    return { incoming, outgoing, net, balance }
  }, [data, accountId, accounts])

  function clearFilters() {
    setDirection('all')
    setAccountId('')
    setFrom('')
    setTo('')
    setSearch('')
    refetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Transaction History</h1>
          <p className="text-sm text-muted-foreground">Full ledger view with filters for account, direction, and date range.</p>
        </div>
        <Button asChild variant="outline" className="w-full md:w-auto">
          <Link to="/transactions">Back to Transactions</Link>
        </Button>
      </div>

      <div className="rounded-3xl border bg-white/80 p-6 shadow-sm space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Account</label>
            <select
              className="h-10 rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:outline-none"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Search notes</label>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes" className="h-10" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'in', 'out', 'transfer'] as DirectionSegment[]).map((value) => (
            <button
              key={value}
              type="button"
              className={`rounded-full border px-4 py-1 text-sm transition-colors ${
                direction === value
                  ? 'border-primary bg-primary text-white'
                  : 'border-muted-foreground/30 bg-muted/20 text-muted-foreground hover:border-primary/60'
              }`}
              onClick={() => setDirection(value)}
            >
              {value === 'all' ? 'All directions' : directionLabels[value]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="w-full sm:w-auto" onClick={clearFilters}>Reset filters</Button>
          <Button variant="secondary" className="w-full sm:w-auto" onClick={refetch}>Refresh</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Received</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{formatCurrency(Math.abs(totals.incoming))}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Paid out</p>
          <p className="mt-1 text-2xl font-semibold text-rose-600">{formatCurrency(Math.abs(totals.outgoing))}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Net change</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(totals.net)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Closing balance</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(totals.balance)}</p>
        </div>
      </div>

      {error && <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">{error}</div>}

      <div className="overflow-auto rounded-3xl border bg-white/90 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Direction</th>
              <th className="px-4 py-2 text-left">Notes</th>
              <th className="px-4 py-2 text-left">Account</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {!loading && data.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>No transactions found.</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>Loading transactions...</td>
              </tr>
            )}
            {data.map((tx) => (
              <tr key={tx.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2">{formatDate(tx.date as any)}</td>
                <td className="px-4 py-2 capitalize">{directionLabels[tx.direction as Exclude<DirectionSegment, 'all'>] || 'Transfer'}</td>
                <td className="px-4 py-2 text-muted-foreground">{tx.notes || 'N/A'}</td>
                <td className="px-4 py-2">{accountLookup.get(tx.account_id) || 'Account'}</td>
                <td className="px-4 py-2 text-right font-medium">{formatCurrency(Math.abs(tx.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
