import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Transaction } from '../types/transactions'

export type TxFilters = {
  accountId?: string
  categoryId?: string
  partyId?: string
  scope?: 'personal' | 'work'
  from?: string
  to?: string
  search?: string
}

export function useTransactions(filters: TxFilters = {}) {
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const deps = useMemo(() => JSON.stringify(filters), [filters])

  const fetchData = async () => {
    setLoading(true)
    let q = supabase
      .from('transactions')
      .select('id,account_id,date,amount,qty,direction,scope,mode,category_id,party_id,notes')
      .order('date', { ascending: false })

    if (filters.accountId) q = q.eq('account_id', filters.accountId)
    if (filters.categoryId) q = q.eq('category_id', filters.categoryId)
    if (filters.partyId) q = q.eq('party_id', filters.partyId)
    if (filters.scope) q = q.eq('scope', filters.scope)
    if (filters.from) q = q.gte('date', filters.from)
    if (filters.to) q = q.lte('date', filters.to)
    if (filters.search) q = q.ilike('notes', `%${filters.search}%`)

    const { data, error } = await q
    if (error) setError(error.message)
    setData((data as any) || [])
    setLoading(false)
  }

  useEffect(() => {
    ;(async () => {
      await fetchData()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps])

  return { data, loading, error, refetch: fetchData }
}
