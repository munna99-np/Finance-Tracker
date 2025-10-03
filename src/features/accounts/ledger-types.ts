import type { Account } from '../../types/accounts'

export type AccountFlowRecord = {
  id: string
  date: Date
  direction: 'in' | 'out'
  amount: number
  counterparty: string
  source: 'transaction' | 'transfer'
  notes?: string | null
}

export type AccountLedgerSummary = {
  account: Account
  balance: number
  credit: number
  debit: number
  incoming: AccountFlowRecord[]
  outgoing: AccountFlowRecord[]
}
