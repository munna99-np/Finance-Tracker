import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { StaffAdvance } from '../types/staffAdvance'

export function useStaffAdvances(staffId?: string) {
  const [data, setData] = useState<StaffAdvance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const deps = useMemo(() => staffId ?? '', [staffId])

  const refetch = async () => {
    setLoading(true)
    let q = supabase
      .from('staff_advances')
      .select('id,staff_id,date,amount,notes')
      .order('date', { ascending: false })
    if (staffId) q = q.eq('staff_id', staffId)
    const { data, error } = await q
    if (error) setError(error.message)
    setData(((data as unknown) as StaffAdvance[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    ;(async () => {
      await refetch()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps])

  return { data, loading, error, refetch }
}
