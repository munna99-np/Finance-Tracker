import clsx from 'clsx'
import { Dialog, DialogContent, DialogTitle } from '../../components/ui/dialog'
import { formatCurrency } from '../../lib/format'
import type { Transaction } from '../../types/transactions'

type TransactionWithMeta = (Transaction & {
  accountName?: string | null
  partyName?: string | null
  categoryName?: string | null
}) | null | undefined

type TransactionDetailsDialogProps = {
  transaction: TransactionWithMeta
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return 'N/A'
  try {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return 'N/A'
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  } catch {
    return String(value)
  }
}

function getStatus(direction: Transaction['direction']) {
  switch (direction) {
    case 'in':
      return { label: 'Receive', tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
    case 'out':
      return { label: 'Payment', tone: 'text-rose-600 bg-rose-50 border-rose-200' }
    default:
      return { label: 'Transfer', tone: 'text-blue-600 bg-blue-50 border-blue-200' }
  }
}

export default function TransactionDetailsDialog({ transaction, open, onOpenChange }: TransactionDetailsDialogProps) {
  const amount = transaction?.amount ?? 0
  const status = getStatus(transaction?.direction || 'in')
  const isPositive = amount >= 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl rounded-xl border bg-white p-6 shadow-2xl">
        <DialogTitle className="text-lg font-semibold">Transaction Details</DialogTitle>
        {!transaction ? (
          <div className="mt-6 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">Select a transaction to see its details.</div>
        ) : (
          <div className="mt-5 space-y-6">
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount</p>
                <p className="text-2xl font-semibold">{formatCurrency(Math.abs(amount))}</p>
                <p className="text-sm text-muted-foreground">{isPositive ? 'Incoming' : 'Outgoing'} ({transaction.direction})</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={clsx('rounded-full border px-3 py-1 text-xs font-medium capitalize', status.tone)}>{status.label}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">When</p>
                <p className="text-sm font-semibold">{formatDate(transaction.date as any)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Account</p>
                <p className="text-sm font-semibold">{transaction.accountName || 'N/A'}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Scope</p>
                <p className="text-sm font-semibold capitalize">{transaction.scope}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Mode</p>
                <p className="text-sm font-semibold">{transaction.mode || 'N/A'}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Category</p>
                <p className="text-sm font-semibold">{transaction.categoryName || 'N/A'}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Party</p>
                <p className="text-sm font-semibold">{transaction.partyName || 'N/A'}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Quantity</p>
                <p className="text-sm font-semibold">{transaction.qty ?? 'N/A'}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Notes</p>
                <p className="text-sm font-semibold">{transaction.notes || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}