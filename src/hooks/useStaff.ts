import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Staff } from '../types/staff'

export function useStaff() {
  const [data, setData] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    setLoading(true)
    const { data, error } = await supabase
      .from('staff')
      .select('id,name,phone,role,joined_on')
      .order('name')
    if (error) setError(error.message)
    setData((data as any) || [])
    setLoading(false)
  }

  useEffect(() => { refetch() }, [])

  return { data, loading, error, refetch }
}

