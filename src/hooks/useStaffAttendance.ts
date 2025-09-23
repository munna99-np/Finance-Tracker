import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { StaffAttendance, StaffAttendanceStatus } from '../types/staffAttendance'

type SaveAttendanceArgs = {
  staffId: string
  date: string
  status: StaffAttendanceStatus
  notes?: string | null
}

type MonthRange = { start: string; end: string } | null

function getMonthRange(month?: string): MonthRange {
  if (!month || month.length !== 7) return null
  const [yearStr, monthStr] = month.split('-')
  const year = Number(yearStr)
  const monthNum = Number(monthStr)
  const monthIndex = monthNum - 1
  if (!Number.isFinite(year) || !Number.isFinite(monthNum) || monthIndex < 0 || monthIndex > 11) return null
  const paddedMonth = String(monthIndex + 1).padStart(2, '0')
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const endDay = String(lastDay).padStart(2, '0')
  const start = [yearStr, paddedMonth, '01'].join('-')
  const end = [yearStr, paddedMonth, endDay].join('-')
  return { start, end }
}

export function useStaffAttendance(month?: string) {
  const [data, setData] = useState<StaffAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo(() => getMonthRange(month), [month])

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase
      .from('staff_attendance')
      .select('id,staff_id,date,status,notes')
      .order('date', { ascending: false })
    if (range) query = query.gte('date', range.start).lte('date', range.end)
    const { data, error } = await query
    if (error) setError(error.message)
    setData(((data as unknown) as StaffAttendance[]) || [])
    setLoading(false)
  }, [range])

  useEffect(() => {
    ;(async () => {
      await refetch()
    })()
  }, [refetch])

  const saveAttendance = useCallback(async ({ staffId, date, status, notes }: SaveAttendanceArgs) => {
    const payload = {
      staff_id: staffId,
      date,
      status,
      notes: notes && notes.trim().length > 0 ? notes.trim() : null,
    }
    const { error } = await supabase
      .from('staff_attendance')
      .upsert(payload, { onConflict: 'owner,staff_id,date' })
    return { error: error?.message ?? null }
  }, [])

  const deleteAttendance = useCallback(async (staffId: string, date: string) => {
    const { error } = await supabase
      .from('staff_attendance')
      .delete()
      .eq('staff_id', staffId)
      .eq('date', date)
    return { error: error?.message ?? null }
  }, [])

  return { data, loading, error, refetch, saveAttendance, deleteAttendance, range }
}
