import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { StaffSalary } from '../types/staffSalary'

export function useStaffSalaries(staffId?: string) {
  const [data, setData] = useState<StaffSalary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const deps = useMemo(() => staffId ?? '', [staffId])

  const refetch = async () => {
    setLoading(true)
    let q = supabase
      .from('staff_salaries')
      .select('id,staff_id,period,amount,paid_on,notes')
      .order('period', { ascending: false })
    if (staffId) q = q.eq('staff_id', staffId)
    const { data, error } = await q
    if (error) setError(error.message)
    setData(((data as unknown) as StaffSalary[]) || [])
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
