import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Account } from '../types/accounts'

export function useAccounts() {
  const [data, setData] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    setLoading(true)
    const { data, error } = await supabase
      .from('accounts')
      .select('id,name,kind,opening_balance,is_active')
      .order('name', { ascending: true })
    if (error) setError(error.message)
    setData((data as any) || [])
    setLoading(false)
  }

  useEffect(() => {
    ;(async () => {
      await refetch()
    })()
  }, [])

  return { data, loading, error, refetch }
}
