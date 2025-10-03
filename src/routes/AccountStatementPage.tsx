import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import clsx from 'clsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Download, FileText, RefreshCcw, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAccounts } from '../hooks/useAccounts'
import { useTransfers } from '../hooks/useTransfers'
import { formatCurrency } from '../lib/format'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'

type StatementRow = {
  id: string
  date: Date
  direction: 'in' | 'out'
  amount: number
  otherAccount: string
  notes?: string | null
}

type StatementSummary = {
  opening: number
  incomingTotal: number
  outgoingTotal: number
  net: number
  balance: number
  lastTransfer?: Date
  firstTransfer?: Date
  largestTransfer: number
  transferCount: number
}

export default function AccountStatementPage() {
  const { accountId = '' } = useParams<{ accountId: string }>()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')

  const deferredSearch = useDeferredValue(search)

  const { data: accounts, loading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useAccounts()
  const { data: transfers, loading: transfersLoading, error: transfersError, refetch: refetchTransfers } = useTransfers({
    accountId: accountId || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    search: deferredSearch.trim() ? deferredSearch.trim() : undefined,
    limit: 1000,
  })

  const account = useMemo(() => accounts.find((acc) => acc.id === accountId), [accounts, accountId])

  useEffect(() => {
    if (account?.name) {
      document.title = `${account.name} - Account Statement`
    }
  }, [account?.name])

  const { timeline, summary } = useMemo(() => {
    const opening = account?.opening_balance ?? 0
    const accountNameLookup = new Map(accounts.map((acc) => [acc.id, acc.name]))

    const rows: StatementRow[] = transfers.map((transfer) => {
      const rawDate = transfer.date instanceof Date ? transfer.date : new Date(transfer.date)
      const date = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate
      const amount = Math.abs(Number(transfer.amount) || 0)
      const incoming = transfer.to_account === accountId
      const otherId = incoming ? transfer.from_account : transfer.to_account
      const otherAccount = accountNameLookup.get(otherId) ?? 'Unlinked account'
      return {
        id: transfer.id,
        date,
        direction: incoming ? 'in' : 'out',
        amount,
        otherAccount,
        notes: transfer.notes,
      }
    })

    rows.sort((a, b) => b.date.getTime() - a.date.getTime())

    let incomingTotal = 0
    let outgoingTotal = 0
    let largestTransfer = 0

    for (const row of rows) {
      if (row.direction === 'in') incomingTotal += row.amount
      else outgoingTotal += row.amount
      if (row.amount > largestTransfer) largestTransfer = row.amount
    }

    const net = incomingTotal - outgoingTotal
    const balance = opening + net

    const summary: StatementSummary = {
      opening,
      incomingTotal,
      outgoingTotal,
      net,
      balance,
      lastTransfer: rows[0]?.date,
      firstTransfer: rows.length > 0 ? rows[rows.length - 1].date : undefined,
      largestTransfer,
      transferCount: rows.length,
    }

    return { timeline: rows, summary }
  }, [account, accounts, transfers, accountId])

  const loading = accountsLoading || transfersLoading
  const errorMessage = accountsError || transfersError

  const refreshPage = () => {
    refetchAccounts()
    refetchTransfers()
  }

  const clearFilters = () => {
    setFromDate('')
    setToDate('')
    setSearch('')
  }

  const buildPeriodLabel = (emptyLabel: string) => {
    if (fromDate || toDate) {
      const start = fromDate ? formatIsoDate(fromDate) : 'Beginning'
      const end = toDate ? formatIsoDate(toDate) : 'Today'
      return `${start} to ${end}`
    }
    if (summary.transferCount > 0) {
      const start = summary.firstTransfer ? formatDateDisplay(summary.firstTransfer) : 'First record'
      const end = summary.lastTransfer ? formatDateDisplay(summary.lastTransfer) : 'Latest record'
      return `${start} to ${end}`
    }
    return emptyLabel
  }

  const periodLabel = buildPeriodLabel('All activity')
  const pdfPeriodLabel = buildPeriodLabel('All recorded activity')

  const handleDownloadPdf = () => {
    if (!account) return

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text(`${account.name} - Statement`, 40, 60)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(80)
    doc.text(`Generated on ${formatDateTime(new Date())}`, 40, 82)
    doc.text(`Period: ${pdfPeriodLabel}`, 40, 100)
    doc.text(`Transfers: ${summary.transferCount}`, 40, 118)

    autoTable(doc, {
      startY: 140,
      theme: 'plain',
      styles: { fontSize: 11, cellPadding: 6, textColor: [45, 55, 72] },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [30, 41, 59] },
        1: { halign: 'right' },
      },
      body: [
        ['Opening balance', formatCurrency(summary.opening)],
        ['Incoming', formatCurrency(summary.incomingTotal)],
        ['Outgoing', formatCurrency(summary.outgoingTotal)],
        ['Net movement', formatCurrency(summary.net)],
        ['Closing balance', formatCurrency(summary.balance)],
      ],
    })

    const docAny = doc as any
    const nextY = (docAny.lastAutoTable?.finalY ?? 140) + 24

    if (timeline.length === 0) {
      doc.setTextColor(100)
      doc.text('No transfers recorded in this period.', 40, nextY)
    } else {
      autoTable(doc, {
        startY: nextY,
        head: [['Date', 'Direction', 'Counterparty', 'Amount', 'Notes']],
        body: timeline.map((row) => [
          formatDateDisplay(row.date),
          row.direction === 'in' ? 'Incoming' : 'Outgoing',
          row.otherAccount,
          formatCurrency(row.amount),
          row.notes || '',
        ]),
        styles: { fontSize: 10, cellPadding: 6, textColor: [44, 62, 80] },
        headStyles: { fillColor: [76, 92, 205], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        columnStyles: { 3: { halign: 'right' } },
      })
    }

    doc.save(`${slugify(account.name)}-statement.pdf`)
  }

  if (!account && !accountsLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild className="gap-2">
          <Link to="/accounts">
            <ArrowLeft className="h-4 w-4" />
            Back to accounts
          </Link>
        </Button>
        <Card className="border border-rose-200/70 bg-rose-50/80">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-rose-700">Account not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-rose-700">
            <p>The account you are looking for does not exist or may have been removed.</p>
            <Button variant="outline" asChild className="border-rose-300 text-rose-700 hover:bg-rose-100">
              <Link to="/accounts">Return to accounts overview</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-primary">
          <Link to="/accounts">
            <ArrowLeft className="h-4 w-4" />
            Back to accounts
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshPage} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleDownloadPdf} disabled={!account || timeline.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-slate-100/70 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-20 top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-20 h-24 w-24 rounded-full border border-white/15" />
        <div className="relative space-y-8 p-8">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-white/60">Account statement</p>
            <h1 className="text-3xl font-semibold md:text-4xl">{account?.name || 'Loading account...'}</h1>
            <p className="text-sm text-white/70">
              Statement period: {periodLabel}. {summary.transferCount} transfer{summary.transferCount === 1 ? '' : 's'} recorded.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatementStat icon={ArrowDownLeft} label="Incoming" value={formatCurrency(summary.incomingTotal)} helper="Credited via transfers" />
            <StatementStat icon={ArrowUpRight} label="Outgoing" value={formatCurrency(summary.outgoingTotal)} helper="Debited via transfers" />
            <StatementStat
              icon={TrendingUp}
              label="Net movement"
              value={formatCurrency(summary.net)}
              helper={summary.net >= 0 ? 'Net inflow' : 'Net outflow'}
              tone={summary.net >= 0 ? 'emerald' : 'rose'}
            />
            <StatementStat icon={FileText} label="Closing balance" value={formatCurrency(summary.balance)} helper={`Opening ${formatCurrency(summary.opening)}`} />
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-slate-200/60 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Loading statement...
        </div>
      )}

      <Card className="border border-slate-200/70 bg-white/95 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold text-slate-900">Filter transfers</CardTitle>
          <p className="text-xs text-muted-foreground">Choose a date range or search through transfer notes to refine the statement.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[160px] flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="from-date">
                From
              </label>
              <Input id="from-date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </div>
            <div className="flex min-w-[160px] flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="to-date">
                To
              </label>
              <Input id="to-date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
            <div className="flex min-w-[220px] flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="search-notes">
                Search notes
              </label>
              <Input
                id="search-notes"
                placeholder="e.g. vendor, purpose, memo"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} disabled={!fromDate && !toDate && !search}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <Card className="border border-indigo-200/60 bg-gradient-to-br from-indigo-50 via-white to-purple-50 shadow-inner">
            <CardHeader className="space-y-3">
              <CardTitle className="text-sm font-semibold text-slate-900">Balance snapshot</CardTitle>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>
                  Opening balance <span className="font-semibold text-slate-900">{formatCurrency(summary.opening)}</span>
                </li>
                <li>
                  Net movement <span className={clsx('font-semibold', summary.net >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{formatCurrency(summary.net)}</span>
                </li>
                <li>
                  Closing balance <span className="font-semibold text-slate-900">{formatCurrency(summary.balance)}</span>
                </li>
                <li>
                  Largest transfer <span className="font-semibold text-slate-900">{formatCurrency(summary.largestTransfer)}</span>
                </li>
                <li>
                  Last transfer{' '}
                  <span className="font-semibold text-slate-900">
                    {summary.lastTransfer ? formatDateDisplay(summary.lastTransfer) : 'Not recorded'}
                  </span>
                </li>
              </ul>
            </CardHeader>
          </Card>
        </aside>

        <Card className="border border-slate-200/70 bg-white/95 shadow-sm">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">Transfer history</CardTitle>
              <p className="text-xs text-muted-foreground">Newest first - {summary.transferCount} item{summary.transferCount === 1 ? '' : 's'}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {timeline.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200/70 bg-slate-50 px-4 py-6 text-center text-sm text-muted-foreground">
                No transfers found for the selected filters.
              </div>
            )}

            {timeline.map((row) => (
              <TransferTimelineRow key={`${row.id}-${row.direction}`} row={row} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatementStat({
  icon: Icon,
  label,
  value,
  helper,
  tone = 'slate',
}: {
  icon: LucideIcon
  label: string
  value: string
  helper: string
  tone?: 'slate' | 'emerald' | 'rose'
}) {
  const iconClasses =
    tone === 'emerald'
      ? 'bg-emerald-500/20 text-emerald-200'
      : tone === 'rose'
        ? 'bg-rose-500/20 text-rose-200'
        : 'bg-white/20 text-white'
  const valueClasses = tone === 'emerald' ? 'text-emerald-100' : tone === 'rose' ? 'text-rose-100' : 'text-white'
  const helperClasses = tone === 'emerald' ? 'text-emerald-100/80' : tone === 'rose' ? 'text-rose-100/80' : 'text-white/70'

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-4 shadow-sm transition duration-300 hover:bg-white/15">
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-0 transition group-hover:opacity-100" />
      <div className="relative space-y-3">
        <span className={clsx('inline-flex h-10 w-10 items-center justify-center rounded-xl', iconClasses)}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/70">{label}</p>
          <p className={clsx('text-lg font-semibold', valueClasses)}>{value}</p>
          <p className={clsx('text-xs', helperClasses)}>{helper}</p>
        </div>
      </div>
    </div>
  )
}

function TransferTimelineRow({ row }: { row: StatementRow }) {
  const incoming = row.direction === 'in'

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-white/95 px-4 py-3 shadow-sm transition hover:border-indigo-200">
      <div className={clsx('flex h-12 w-12 items-center justify-center rounded-xl text-xl', incoming ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
        {incoming ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold text-slate-900">{row.otherAccount}</p>
          <span className={clsx('whitespace-nowrap text-sm font-semibold', incoming ? 'text-emerald-600' : 'text-rose-600')}>
            {incoming ? '+' : '-'}
            {formatCurrency(row.amount)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDateDisplay(row.date)}
          {row.notes ? ` - ${row.notes}` : ''}
        </p>
      </div>
    </div>
  )
}

function formatIsoDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return formatDateDisplay(date)
}

function formatDateDisplay(date: Date) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
  } catch {
    return date.toString()
  }
}

function formatDateTime(date: Date) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  } catch {
    return date.toString()
  }
}

function slugify(value: string) {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned || 'account'
}
