import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useStaffAdvances(staffId?: string) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    setLoading(true)
    let q = supabase.from('staff_advances').select('id,staff_id,date,amount,notes').order('date', { ascending: false })
    if (staffId) q = q.eq('staff_id', staffId)
    const { data, error } = await q
    if (error) setError(error.message)
    setData((data as any) || [])
    setLoading(false)
  }

  useEffect(() => { refetch() }, [staffId])

  return { data, loading, error, refetch }
}

