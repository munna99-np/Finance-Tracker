import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export type TransferRow = {
  id: string
  from_account: string
  to_account: string
  date: string | Date
  amount: number
  notes?: string | null
}

export type TransferFilters = {
  fromAccount?: string
  toAccount?: string
  accountId?: string
  fromDate?: string
  toDate?: string
  search?: string
  limit?: number
}

export function useTransfers(filters: TransferFilters = {}) {
  const [data, setData] = useState<TransferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    setLoading(true)
    setError(null)

    try {
      const limit = typeof filters.limit === 'number' && filters.limit > 0 ? filters.limit : 200

      let query = supabase
        .from('transfers')
        .select('id,from_account,to_account,date,amount,notes')
        .order('date', { ascending: false })
        .limit(limit)

      if (filters.accountId) {
        query = query.or(`from_account.eq.${filters.accountId},to_account.eq.${filters.accountId}`)
      } else {
        if (filters.fromAccount) query = query.eq('from_account', filters.fromAccount)
        if (filters.toAccount) query = query.eq('to_account', filters.toAccount)
      }

      if (filters.fromDate) query = query.gte('date', filters.fromDate)
      if (filters.toDate) query = query.lte('date', filters.toDate)
      if (filters.search) query = query.ilike('notes', `%${filters.search}%`)

      const { data, error } = await query
      if (error) throw new Error(error.message)
      setData((data as any) || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load transfers'
      setError(message)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.accountId,
    filters.fromAccount,
    filters.toAccount,
    filters.fromDate,
    filters.toDate,
    filters.search,
    filters.limit,
  ])

  return { data, loading, error, refetch }
}
