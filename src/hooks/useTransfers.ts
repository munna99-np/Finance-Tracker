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
  fromDate?: string // YYYY-MM-DD
  toDate?: string   // YYYY-MM-DD
  search?: string   // notes search
}

export function useTransfers(filters: TransferFilters = {}) {
  const [data, setData] = useState<TransferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    setLoading(true)
    let q = supabase
      .from('transfers')
      .select('id,from_account,to_account,date,amount,notes')
      .order('date', { ascending: false })
      .limit(200)
    if (filters.fromAccount) q = q.eq('from_account', filters.fromAccount)
    if (filters.toAccount) q = q.eq('to_account', filters.toAccount)
    if (filters.fromDate) q = q.gte('date', filters.fromDate)
    if (filters.toDate) q = q.lte('date', filters.toDate)
    if (filters.search) q = q.ilike('notes', `%${filters.search}%`)
    const { data, error } = await q
    if (error) setError(error.message)
    setData((data as any) || [])
    setLoading(false)
  }

  useEffect(() => {
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.fromAccount, filters.toAccount, filters.fromDate, filters.toDate, filters.search])

  return { data, loading, error, refetch }
}
