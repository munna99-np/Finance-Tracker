import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { toCsv, download } from '../../lib/csv'
import { printHtml } from '../../lib/print'
import { useTransactions } from '../../hooks/useTransactions'
import { useTransfers } from '../../hooks/useTransfers'
import { formatCurrency } from '../../lib/format'
import type { Account } from '../../types/accounts'

export default function AccountDetailsDialog({ account, open, onOpenChange }: { account?: Account | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [search, setSearch] = useState('')

  const accountId = account?.id
  const { data: txns, loading: txLoading, error: txError } = useTransactions({ accountId, from, to, search })
  const { data: transfers, loading: trLoading, error: trError } = useTransfers({ fromAccount: accountId, toAccount: accountId, fromDate: from, toDate: to, search })

  const balance = useMemo(() => {
    if (!account) return 0
    let b = account.opening_balance
    for (const t of txns) b += t.amount
    for (const tr of transfers) {
      if (tr.from_account === account.id) b -= tr.amount
      if (tr.to_account === account.id) b += tr.amount
    }
    return b
  }, [account, txns, transfers])

  function exportTxns() {
    const rows = txns.map((t) => ({
      date: t.date as any,
      direction: t.direction,
      amount: t.amount,
      qty: t.qty ?? '',
      scope: t.scope,
      mode: t.mode ?? '',
      category_id: t.category_id ?? '',
      party_id: t.party_id ?? '',
      notes: t.notes ?? '',
    }))
    const csv = toCsv(rows, ['date', 'direction', 'amount', 'qty', 'scope', 'mode', 'category_id', 'party_id', 'notes'])
    download(`${account?.name || 'account'}-transactions.csv`, csv)
  }

  function exportTransfers() {
    const rows = transfers.map((t) => ({ date: t.date as any, from_account: t.from_account, to_account: t.to_account, amount: t.amount, notes: t.notes ?? '' }))
    const csv = toCsv(rows, ['date', 'from_account', 'to_account', 'amount', 'notes'])
    download(`${account?.name || 'account'}-transfers.csv`, csv)
  }

  function printHistory() {
    const title = `Account Statement - ${account?.name || ''}`
    const rows = txns
      .map((t) => `<tr><td>${t.date as any}</td><td>${t.direction}</td><td class="num">${formatCurrency(t.amount)}</td><td class="muted">${t.notes || ''}</td></tr>`) 
      .join('')
    const html = `
      <div class="header">
        <div class="brand"><div class="badge">Account</div><h1>${account?.name || ''}</h1></div>
        <div class="muted">Balance: <strong>${formatCurrency(balance)}</strong></div>
      </div>
      <div class="card">
        <div class="card-title">Transactions</div>
        <table><thead><tr><th>Date</th><th>Direction</th><th>Amount</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `
    printHtml(title, html)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border rounded-lg p-4 shadow-xl max-w-5xl w-[98vw]">
        <DialogTitle className="flex items-center justify-between pr-1">
          <span>{account?.name || 'Account'}</span>
          <span className="text-sm text-muted-foreground">Balance: <span className="font-semibold">{formatCurrency(balance)}</span></span>
        </DialogTitle>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36" />
          <Input placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-60" />
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportTxns}>Export Transactions</Button>
            <Button size="sm" variant="outline" onClick={exportTransfers}>Export Transfers</Button>
            <Button size="sm" onClick={printHistory}>Print</Button>
          </div>
        </div>

        {(txError || trError) && <div className="text-sm text-red-600 mt-2">{txError || trError}</div>}

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-lg border">
            <div className="px-3 py-2 text-sm font-medium bg-muted/50">Transactions</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Dir</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {txLoading && <tr><td className="p-2 text-muted-foreground" colSpan={4}>Loading…</td></tr>}
                  {!txLoading && txns.length === 0 && <tr><td className="p-2 text-muted-foreground" colSpan={4}>No transactions</td></tr>}
                  {txns.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="p-2">{String(t.date).slice(0, 10)}</td>
                      <td className="p-2 capitalize">{t.direction}</td>
                      <td className="p-2 text-right">{formatCurrency(t.amount)}</td>
                      <td className="p-2">{t.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border">
            <div className="px-3 py-2 text-sm font-medium bg-muted/50">Transfers</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">From</th>
                    <th className="p-2 text-left">To</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {trLoading && <tr><td className="p-2 text-muted-foreground" colSpan={5}>Loading…</td></tr>}
                  {!trLoading && transfers.length === 0 && <tr><td className="p-2 text-muted-foreground" colSpan={5}>No transfers</td></tr>}
                  {transfers.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="p-2">{String(t.date).slice(0, 10)}</td>
                      <td className="p-2">{t.from_account === account?.id ? 'This' : 'Other'}</td>
                      <td className="p-2">{t.to_account === account?.id ? 'This' : 'Other'}</td>
                      <td className="p-2 text-right">{formatCurrency(t.amount)}</td>
                      <td className="p-2">{t.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

