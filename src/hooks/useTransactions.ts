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

function buildQuery(activeFilters: TxFilters) {
  let query = supabase
    .from('transactions')
    .select('id,account_id,date,amount,qty,direction,scope,mode,category_id,party_id,notes')
    .order('date', { ascending: false })

  if (activeFilters.accountId) query = query.eq('account_id', activeFilters.accountId)
  if (activeFilters.categoryId) {
    if (activeFilters.categoryId === 'uncategorized') query = query.is('category_id', null)
    else query = query.eq('category_id', activeFilters.categoryId)
  }
  if (activeFilters.partyId) query = query.eq('party_id', activeFilters.partyId)
  if (activeFilters.scope) query = query.eq('scope', activeFilters.scope)
  if (activeFilters.from) query = query.gte('date', activeFilters.from)
  if (activeFilters.to) query = query.lte('date', activeFilters.to)
  if (activeFilters.search) query = query.ilike('notes', `%${activeFilters.search}%`)

  return query
}

export function useTransactions(filters: TxFilters = {}) {
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const serializedFilters = useMemo(() => JSON.stringify(filters), [filters])

  useEffect(() => {
    let isMounted = true
    const activeFilters = JSON.parse(serializedFilters) as TxFilters

    const fetch = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data, error } = await buildQuery(activeFilters)
        if (!isMounted) return

        if (error) {
          setError(error.message)
          setData([])
          return
        }

        setData((data as any) || [])
      } catch (err: unknown) {
        if (!isMounted) return
        const message = err instanceof Error ? err.message : 'Failed to load transactions'
        setError(message)
        setData([])
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetch()

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedFilters])

  const refetch = async () => {
    const activeFilters = JSON.parse(serializedFilters) as TxFilters
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await buildQuery(activeFilters)
      if (error) {
        setError(error.message)
        setData([])
      } else {
        setData((data as any) || [])
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load transactions'
      setError(message)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error, refetch }
}
