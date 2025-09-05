import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Account } from '../../types/accounts'
import type { Transaction } from '../../types/transactions'

export type DashboardData = {
  totalIncome: number
  totalExpense: number
  net: number
  accounts: Array<{
    account: Account
    balance: number
  }>
}

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      const [accRes, txRes, trRes] = await Promise.all([
        supabase.from('accounts').select('id,name,kind,opening_balance,is_active').order('name'),
        supabase.from('transactions').select('id,account_id,amount,direction'),
        supabase.from('transfers').select('from_account,to_account,amount'),
      ])
      if (!active) return
      if (accRes.error) return setError(accRes.error.message), setLoading(false)
      if (txRes.error) return setError(txRes.error.message), setLoading(false)
      if (trRes.error) return setError(trRes.error.message), setLoading(false)

      const accounts = (accRes.data as any as Account[]) || []
      const txns = (txRes.data as any as Transaction[]) || []
      const transfers = (trRes.data as any) || []

      const totalIncome = txns.filter((t) => t.direction === 'in').reduce((s, t) => s + t.amount, 0)
      const totalOutRaw = txns.filter((t) => t.direction === 'out').reduce((s, t) => s + t.amount, 0)
      const totalExpense = Math.abs(totalOutRaw)
      const net = totalIncome - totalExpense

      const byAccountTx = new Map<string, number>()
      for (const t of txns) {
        byAccountTx.set(t.account_id, (byAccountTx.get(t.account_id) || 0) + t.amount)
      }

      const byAccountTr = new Map<string, number>()
      for (const tr of transfers) {
        byAccountTr.set(tr.from_account, (byAccountTr.get(tr.from_account) || 0) - tr.amount)
        byAccountTr.set(tr.to_account, (byAccountTr.get(tr.to_account) || 0) + tr.amount)
      }

      const accountsBalances = accounts.map((a) => {
        const deltaTx = byAccountTx.get(a.id) || 0
        const deltaTr = byAccountTr.get(a.id) || 0
        const balance = a.opening_balance + deltaTx + deltaTr
        return { account: a, balance }
      })

      setData({ totalIncome, totalExpense, net, accounts: accountsBalances })
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  return { data, loading, error }
}
