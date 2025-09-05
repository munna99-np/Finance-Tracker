import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Category } from '../types/categories'

export function useCategories(scope?: 'personal' | 'work') {
  const [data, setData] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    let q = supabase.from('categories').select('id,name,scope,parent_id').order('name')
    if (scope) q = q.eq('scope', scope)
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
  }, [scope])

  const refetch = () => fetchData()

  return { data, loading, error, refetch }
}
