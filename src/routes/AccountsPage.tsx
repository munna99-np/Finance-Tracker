import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowUpRight, FileText, RefreshCcw, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAccounts } from '../hooks/useAccounts'
import { useTransfers } from '../hooks/useTransfers'
import { formatCurrency } from '../lib/format'
import AddAccountForm from '../features/accounts/AddAccountForm'
import type { Account } from '../types/accounts'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

type AccountSnapshot = {
  account: Account
  balance: number
  incomingTotal: number
  outgoingTotal: number
  lastTransfer?: Date
}

type DashboardTotals = {
  totalVolume: number
  latestTransfer?: Date
  accountCount: number
  positiveBalances: number
  combinedBalance: number
}

export default function AccountsPage() {
  const { data: accounts, loading: accountsLoading, error: accountsError, refetch } = useAccounts()
  const {
    data: transfers,
    loading: transfersLoading,
    error: transfersError,
    refetch: refetchTransfers,
  } = useTransfers()

  const { snapshots, totals } = useMemo(() => {
    const accountLookup = new Map<string, Account>()
    const summaryLookup = new Map<string, AccountSnapshot>()
    const shadowAccounts = new Map<string, Account>()

    const ensureSummary = (account: Account) => {
      accountLookup.set(account.id, account)
      if (!summaryLookup.has(account.id)) {
        summaryLookup.set(account.id, {
          account,
          balance: account.opening_balance,
          incomingTotal: 0,
          outgoingTotal: 0,
          lastTransfer: undefined,
        })
      }
      return summaryLookup.get(account.id)!
    }

    const ensureSummaryById = (id: string) => {
      const existing = accountLookup.get(id)
      if (existing) return ensureSummary(existing)
      const fallback =
        shadowAccounts.get(id) ||
        ({
          id,
          name: 'Unlinked account',
          kind: 'company',
          opening_balance: 0,
          is_active: true,
        } as Account)
      shadowAccounts.set(id, fallback)
      return ensureSummary(fallback)
    }

    accounts.forEach((account) => ensureSummary(account))

    let totalVolume = 0
    let latestTransfer: Date | undefined

    transfers.forEach((transfer) => {
      const amount = Math.abs(Number(transfer.amount) || 0)
      if (!Number.isFinite(amount) || amount === 0) return

      const rawDate = transfer.date instanceof Date ? transfer.date : new Date(transfer.date)
      const date = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate

      totalVolume += amount
      latestTransfer = mostRecent(latestTransfer, date)

      const fromSummary = ensureSummaryById(transfer.from_account)
      const toSummary = ensureSummaryById(transfer.to_account)

      fromSummary.outgoingTotal += amount
      fromSummary.balance -= amount
      fromSummary.lastTransfer = mostRecent(fromSummary.lastTransfer, date)

      toSummary.incomingTotal += amount
      toSummary.balance += amount
      toSummary.lastTransfer = mostRecent(toSummary.lastTransfer, date)
    })

    const snapshots = Array.from(summaryLookup.values()).sort((a, b) => {
      const aTime = a.lastTransfer ? a.lastTransfer.getTime() : 0
      const bTime = b.lastTransfer ? b.lastTransfer.getTime() : 0
      if (bTime !== aTime) return bTime - aTime
      return b.balance - a.balance
    })

    const combinedBalance = snapshots.reduce((sum, snapshot) => sum + snapshot.balance, 0)
    const positiveBalances = snapshots.filter((snapshot) => snapshot.balance >= 0).length

    const totals: DashboardTotals = {
      totalVolume,
      latestTransfer,
      accountCount: snapshots.length,
      positiveBalances,
      combinedBalance,
    }

    return { snapshots, totals }
  }, [accounts, transfers])

  const loading = accountsLoading || transfersLoading
  const errorMessage = accountsError || transfersError

  const refreshAll = () => {
    refetch()
    refetchTransfers()
  }

  return (
    <div className="space-y-8">
      <Card className="border border-slate-200/70 bg-white/95 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold text-slate-900">Add new account</CardTitle>
          <p className="text-sm text-muted-foreground">Create another ledger and keep parties separated.</p>
        </CardHeader>
        <CardContent>
          <AddAccountForm onCreated={refetch} />
        </CardContent>
      </Card>

      <section className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-slate-100/60 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800 text-white shadow-xl">
          <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-8 h-24 w-24 rounded-full border border-white/20" />
          <div className="relative space-y-8 p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Account transfers</p>
                <h1 className="text-3xl font-semibold md:text-4xl">Account hub</h1>
                <p className="text-sm text-white/70">
                  Focus on the flow of funds. Each card highlights the account name, current balance, and the latest movements only.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={refreshAll}
                className="bg-white/10 text-white hover:bg-white/20 hover:text-white"
                disabled={loading}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <HeroMetric icon={TrendingUp} label="Transfer volume" value={formatCurrency(totals.totalVolume)} hint="All recorded transfers" />
              <HeroMetric
                icon={FileText}
                label="Managed accounts"
                value={totals.accountCount.toString()}
                hint={
                  totals.accountCount > 0 ? `${totals.positiveBalances} currently above zero` : 'Add your first account'
                }
              />
              <HeroMetric
                icon={ArrowUpRight}
                label="Last transfer"
                value={totals.latestTransfer ? formatDate(totals.latestTransfer) : 'Not recorded yet'}
                hint={`Combined balance ${formatCurrency(totals.combinedBalance)}`}
              />
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
        )}

        {loading && (
          <div className="rounded-lg border border-slate-200/60 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Loading transfer insights...
          </div>
        )}

        {snapshots.length === 0 && !loading ? (
          <div className="rounded-lg border border-dashed border-slate-200/60 px-4 py-10 text-center text-sm text-muted-foreground">
            No accounts yet. Add an account to begin tracking balances.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {snapshots.map((snapshot) => (
              <AccountCard key={snapshot.account.id} snapshot={snapshot} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function HeroMetric({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-4 text-white shadow-sm transition duration-300 hover:bg-white/15">
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-0 transition group-hover:opacity-100" />
      <div className="relative flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
          <Icon className="h-5 w-5" />
        </span>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-white/70">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
          <p className="text-xs text-white/60">{hint}</p>
        </div>
      </div>
    </div>
  )
}

function AccountCard({ snapshot }: { snapshot: AccountSnapshot }) {
  const balanceTone = snapshot.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'

  return (
    <Card className="border border-slate-200/70 bg-white/95 shadow-sm transition hover:-translate-y-[2px] hover:shadow-lg">
      <CardHeader className="space-y-3 text-center sm:text-left">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {snapshot.account.kind === 'personal' ? 'Personal account' : 'Company account'}
        </p>
        <CardTitle className="text-2xl font-semibold text-slate-900">{snapshot.account.name}</CardTitle>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Current balance</p>
          <p className={clsx('text-3xl font-semibold', balanceTone)}>{formatCurrency(snapshot.balance)}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-2 text-sm">
          <DetailRow label="Opening balance" value={formatCurrency(snapshot.account.opening_balance)} />
          <DetailRow label="Last transfer" value={snapshot.lastTransfer ? formatDate(snapshot.lastTransfer) : 'Not recorded'} />
          <DetailRow label="Incoming" value={formatCurrency(snapshot.incomingTotal)} />
          <DetailRow label="Outgoing" value={formatCurrency(snapshot.outgoingTotal)} />
        </dl>
        <div className="flex justify-end">
          <Button asChild size="sm" variant="outline" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700">
            <Link to={`/accounts/${snapshot.account.id}`}>View statement</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  )
}

function mostRecent(current: Date | undefined, candidate: Date) {
  if (!candidate) return current
  if (!current) return candidate
  return current.getTime() > candidate.getTime() ? current : candidate
}

function formatDate(value: Date) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
  } catch {
    return value.toString()
  }
}
