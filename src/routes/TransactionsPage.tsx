
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { subDays } from 'date-fns'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { IconExport } from '../components/icons'
import TransactionForm from '../features/transactions/TransactionForm'
import TransactionDetailsDialog from '../features/transactions/TransactionDetailsDialog'
import { useTransactions } from '../hooks/useTransactions'
import { useAccounts } from '../hooks/useAccounts'
import { useParties } from '../hooks/useParties'
import { useCategories } from '../hooks/useCategories'
import { formatCurrency } from '../lib/format'
import { download, toCsv } from '../lib/csv'
import type { Transaction } from '../types/transactions'

type Segment = 'all' | 'received' | 'transfer' | 'payment' | 'withdraw'
type RangePreset = '7' | '30' | '90' | 'all' | 'custom'

type TransactionWithMeta = Transaction & {
  accountName?: string | null
  partyName?: string | null
  categoryName?: string | null
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatDateDisplay(value: Date | string | null | undefined) {
  if (!value) return 'N/A'
  try {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return 'N/A'
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
  } catch {
    return 'N/A'
  }
}

function formatDateWithTime(value: Date | string | null | undefined) {
  if (!value) return 'N/A'
  try {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return 'N/A'
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  } catch {
    return 'N/A'
  }
}

function resolveTransactionFlow(tx: TransactionWithMeta) {
  if (tx.direction === 'in') {
    return {
      kind: 'credit' as const,
      source: tx.partyName || tx.mode || 'External',
      destination: tx.accountName || 'Account',
      label: 'Credit (IN)',
    }
  }
  if (tx.direction === 'out') {
    return {
      kind: 'debit' as const,
      source: tx.accountName || 'Account',
      destination: tx.partyName || tx.mode || 'External',
      label: 'Debit (OUT)',
    }
  }
  return {
    kind: 'transfer' as const,
    source: tx.accountName || 'Account',
    destination: tx.partyName || tx.mode || 'Transfer',
    label: 'Transfer',
  }
}

function isWithdraw(tx: Transaction) {
  const mode = (tx.mode || '').toLowerCase()
  return mode.includes('withdraw') || mode.includes('atm') || mode.includes('cash out') || mode.includes('cashout')
}

const segmentLabels: Record<Segment, string> = {
  all: 'All',
  received: 'Received',
  transfer: 'Transfer',
  payment: 'Payment',
  withdraw: 'Withdraw',
}

const quickRanges: { value: RangePreset; label: string }[] = [
  { value: '7', label: 'Past 7 days' },
  { value: '30', label: 'Past 30 days' },
  { value: '90', label: 'Past 90 days' },
  { value: 'all', label: 'All time' },
]

export default function TransactionsPage() {
  const [segment, setSegment] = useState<Segment>('all')
  const [scope, setScope] = useState<'all' | 'personal' | 'work'>('all')
  const [rangePreset, setRangePreset] = useState<RangePreset>('30')
  const [from, setFrom] = useState(() => toISODate(subDays(new Date(), 29)))
  const [to, setTo] = useState(() => toISODate(new Date()))
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState<TransactionWithMeta | null>(null)

  const { data: accounts } = useAccounts()
  const { data: parties } = useParties()
  const { data: categories } = useCategories()

  const directionFilter = useMemo(() => {
    if (segment === 'received') return 'in' as const
    if (segment === 'transfer') return 'transfer' as const
    if (segment === 'payment' || segment === 'withdraw') return 'out' as const
    return undefined
  }, [segment])

  const { data, loading, error, refetch } = useTransactions({
    scope: scope === 'all' ? undefined : scope,
    direction: directionFilter,
    from: from || undefined,
    to: to || undefined,
  })

  const accountLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const account of accounts) map.set(account.id, account.name)
    return map
  }, [accounts])

  const partyLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const party of parties) map.set(party.id, party.name)
    return map
  }, [parties])

  const categoryLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) map.set(category.id, category.name)
    return map
  }, [categories])

  const decorated = useMemo<TransactionWithMeta[]>(() => {
    return data.map((tx) => ({
      ...tx,
      accountName: accountLookup.get(tx.account_id) || 'Account',
      partyName: tx.party_id ? partyLookup.get(tx.party_id) || 'External' : null,
      categoryName: tx.category_id ? categoryLookup.get(tx.category_id) || 'Category' : null,
    }))
  }, [data, accountLookup, partyLookup, categoryLookup])

  const filtered = useMemo(() => {
    return decorated.filter((tx) => {
      if (segment === 'withdraw') return isWithdraw(tx)
      if (segment === 'payment') return tx.direction === 'out' && !isWithdraw(tx)
      return true
    })
  }, [decorated, segment])

  const summary = useMemo(() => {
    let received = 0
    let paid = 0
    let transferTotal = 0
    for (const tx of filtered) {
      if (tx.direction === 'in') received += tx.amount
      else if (tx.direction === 'out') paid += Math.abs(tx.amount)
      else if (tx.direction === 'transfer') transferTotal += Math.abs(tx.amount)
    }
    const net = filtered.reduce((sum, tx) => sum + tx.amount, 0)
    const balanceBase = accounts.reduce((sum, account) => sum + account.opening_balance, 0)
    const running = data.reduce((sum, tx) => sum + tx.amount, 0)
    const balance = balanceBase + running
    return { received, paid, transfer: transferTotal, net, balance, count: filtered.length }
  }, [filtered, accounts, data])

  function applyRange(preset: RangePreset) {
    setRangePreset(preset)
    if (preset === 'custom') return
    if (preset === 'all') {
      setFrom('')
      setTo('')
      return
    }
    const daysMap: Record<'7' | '30' | '90', number> = { '7': 6, '30': 29, '90': 89 }
    const end = new Date()
    const start = subDays(end, daysMap[preset])
    setFrom(toISODate(start))
    setTo(toISODate(end))
  }

  function resetFilters() {
    setSegment('all')
    setScope('all')
    setRangePreset('30')
    const end = new Date()
    const start = subDays(end, 29)
    setFrom(toISODate(start))
    setTo(toISODate(end))
    refetch()
  }

  function handleExport() {
    const headers = ['date', 'direction', 'scope', 'account', 'party', 'category', 'mode', 'amount', 'notes']
    const rows = filtered.map((tx) => ({
      date: tx.date,
      direction: tx.direction,
      scope: tx.scope,
      account: tx.accountName || '',
      party: tx.partyName || '',
      category: tx.categoryName || '',
      mode: tx.mode || '',
      amount: tx.amount,
      notes: tx.notes || '',
    }))
    const csv = toCsv(rows, headers)
    download('transactions.csv', csv)
  }

  function openDetails(tx: TransactionWithMeta) {
    setSelectedTx(tx)
    setDetailsOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Transactions</h1>
            <p className="text-sm text-muted-foreground">Monitor every payment, transfer, and withdrawal in one place.</p>
          </div>
          <div className="flex w-full flex-col gap-3 md:flex-row md:flex-nowrap md:items-center md:justify-end">
            <div className="text-left md:mr-6 md:text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance</p>
              <p className="text-2xl font-semibold">{formatCurrency(summary.balance)}</p>
            </div>
            <Button className="w-full md:w-auto" asChild variant="secondary">
              <Link to="/transactions/history">Transaction History</Link>
            </Button>
            <Button className="w-full md:w-auto" asChild variant="outline">
              <Link to="/transfers">New Transfer</Link>
            </Button>
            <Button className="w-full md:w-auto" variant="outline" onClick={handleExport}>
              <IconExport className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(segmentLabels) as Segment[]).map((value) => (
            <button
              key={value}
              type="button"
              className={clsx(
                'w-full rounded-full px-4 py-1.5 text-sm font-medium transition-colors sm:w-auto',
                segment === value
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
              )}
              onClick={() => setSegment(value)}
            >
              {segmentLabels[value]}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Scope:</span>
            <select
              className="h-10 min-w-[160px] rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:outline-none"
              value={scope}
              onChange={(event) => setScope(event.target.value as 'all' | 'personal' | 'work')}
            >
              <option value="all">All scopes</option>
              <option value="personal">Personal</option>
              <option value="work">Work</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {quickRanges.map((range) => (
              <Button
                key={range.value}
                size="sm"
                className="w-full sm:w-auto"
                variant={rangePreset === range.value ? 'default' : 'outline'}
                onClick={() => applyRange(range.value)}
              >
                {range.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value)
                setRangePreset('custom')
              }}
              className="h-10 min-w-[150px] flex-1"
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value)
                setRangePreset('custom')
              }}
              className="h-10 min-w-[150px] flex-1"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button className="w-full sm:w-auto" variant="outline" onClick={resetFilters}>Reset</Button>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={refetch}>Refresh</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Transactions</p>
          <p className="mt-1 text-2xl font-semibold">{summary.count}</p>
          <p className="text-xs text-muted-foreground">Filtered results</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Received</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{formatCurrency(Math.abs(summary.received))}</p>
          <p className="text-xs text-muted-foreground">Total inflow</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Paid</p>
          <p className="mt-1 text-2xl font-semibold text-rose-600">{formatCurrency(Math.abs(summary.paid))}</p>
          <p className="text-xs text-muted-foreground">Total outflow</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Net</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(summary.net)}</p>
          <p className="text-xs text-muted-foreground">Inflow minus outflow</p>
        </div>
      </div>

      <Card className="rounded-3xl bg-white/80">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Quick Add Transaction</CardTitle>
            <p className="text-sm text-muted-foreground">Capture a new income, expense, or transfer without leaving this screen.</p>
          </div>
          <Button size="sm" variant="outline" onClick={refetch}>Refresh List</Button>
        </CardHeader>
        <CardContent>
          <TransactionForm onCreated={refetch} initialScope={scope === 'all' ? undefined : scope} />
        </CardContent>
      </Card>

      <div className="rounded-3xl border bg-white/90 shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Transaction Activity</h2>
            <p className="text-sm text-muted-foreground">Detailed ledger of every movement in the selected period.</p>
          </div>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Main Account</th>
                <th className="px-6 py-3 text-left">Flow</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-left">Category</th>
                <th className="px-6 py-3 text-left">Notes</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-6 py-6 text-center text-muted-foreground" colSpan={7}>Loading transactions...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-center text-muted-foreground" colSpan={7}>No transactions found for the selected filters.</td>
                </tr>
              )}
              {!loading && filtered.map((tx) => {
                const flow = resolveTransactionFlow(tx)
                const amount = Math.abs(tx.amount)
                const amountClass = flow.kind === 'credit' ? 'text-emerald-600' : flow.kind === 'debit' ? 'text-rose-600' : 'text-blue-600'
                const amountPrefix = flow.kind === 'credit' ? '+' : flow.kind === 'debit' ? '-' : ''
                const badgeLabel = flow.kind === 'credit' ? 'CR' : flow.kind === 'debit' ? 'DR' : 'TR'
                return (
                  <tr key={tx.id} className="border-t hover:bg-muted/20">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span>{formatDateDisplay(tx.date as any)}</span>
                        <span className="text-xs text-muted-foreground">{formatDateWithTime(tx.date as any)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{tx.accountName}</div>
                      <div className="text-xs text-muted-foreground capitalize">{tx.scope}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{flow.source}</span>
                        <ArrowRight size={14} className="text-muted-foreground" />
                        <span className="font-medium">{flow.destination}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{flow.label}</div>
                    </td>
                    <td className={clsx('px-6 py-4 text-right font-semibold', amountClass)}>
                      {amountPrefix}
                      {formatCurrency(amount)}
                      <span className="ml-2 text-xs font-medium uppercase">{badgeLabel}</span>
                    </td>
                    <td className="px-6 py-4">{tx.categoryName || 'Uncategorised'}</td>
                    <td className="px-6 py-4 text-muted-foreground">{tx.notes || 'N/A'}</td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" variant="outline" onClick={() => openDetails(tx)}>Details</Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {error && <div className="border-t px-6 py-3 text-sm text-rose-600">{error}</div>}
      </div>

      <TransactionDetailsDialog
        transaction={selectedTx}
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open)
          if (!open) setSelectedTx(null)
        }}
      />
    </div>
  )
}
