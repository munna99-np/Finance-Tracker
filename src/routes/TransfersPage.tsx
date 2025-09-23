import TransferForm from '../features/transfers/TransferForm'
import { useTransfers } from '../hooks/useTransfers'
import { useAccounts } from '../hooks/useAccounts'
import { formatCurrency } from '../lib/format'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'sonner'
import { useState } from 'react'
import { Filter } from 'lucide-react'

export default function TransfersPage() {
  const [fromAccount, setFromAccount] = useState<string>('')
  const [toAccount, setToAccount] = useState<string>('')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [showFilters, setShowFilters] = useState<boolean>(false)

  const { data: transfers, error, refetch } = useTransfers({
    fromAccount: fromAccount || undefined,
    toAccount: toAccount || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    search: search || undefined,
  })
  const { data: accounts } = useAccounts()
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name || '-'
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium">Transfers</h1>

      <div className="space-y-4">
        {/* New transfer */}
        <div className="border rounded-md p-3">
          <div className="text-sm font-medium mb-2">New Transfer</div>
          <TransferForm onCreated={refetch} />
        </div>

        {/* Recent transfers (below) */}
        <div className="border rounded-md p-3 overflow-x-auto">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-sm font-medium">Recent Transfers</div>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs hover:bg-muted transition-colors"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              aria-controls="transfer-filters"
            >
              <Filter size={14} />
              Filter
            </button>
          </div>
          {showFilters && (
            <div id="transfer-filters" className="mb-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
              <div>
                <label className="text-xs text-muted-foreground">From account</label>
                <select className="h-9 w-full border rounded-md px-2" value={fromAccount} onChange={(e) => setFromAccount(e.target.value)}>
                  <option value="">All</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To account</label>
                <select className="h-9 w-full border rounded-md px-2" value={toAccount} onChange={(e) => setToAccount(e.target.value)}>
                  <option value="">All</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">From date</label>
                <input className="h-9 w-full border rounded-md px-2" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To date</label>
                <input className="h-9 w-full border rounded-md px-2" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes contains</label>
                <input className="h-9 w-full border rounded-md px-2" placeholder="Search notes" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="md:col-span-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 h-9 rounded-md border text-xs hover:bg-muted"
                  onClick={() => { setFromAccount(''); setToAccount(''); setFromDate(''); setToDate(''); setSearch('') }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">From</th>
                <th className="p-2 text-left">To</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-left">Notes</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => {
                const dateStr = t.date instanceof Date ? t.date.toISOString().slice(0, 10) : String(t.date)
                return (
                  <tr key={t.id} className="border-t hover:bg-muted/30">
                    <td className="p-2">{dateStr}</td>
                    <td className="p-2">{nameOf(t.from_account)}</td>
                    <td className="p-2">{nameOf(t.to_account)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(t.amount)}</td>
                    <td className="p-2 text-muted-foreground">{t.notes ?? '-'}</td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        aria-label="Delete transfer"
                        className="px-2 py-1 rounded-md border text-xs hover:bg-muted transition-colors"
                        onClick={async () => {
                          const { error } = await supabase.from('transfers').delete().eq('id', t.id)
                          if (error) return toast.error(error.message)
                          toast.success('Transfer deleted')
                          refetch()
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
              {transfers.length === 0 && (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={6}>No transfers yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
