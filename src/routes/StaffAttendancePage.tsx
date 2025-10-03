import { useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { StatCard } from '../components/ui/stat-card'
import { cn } from '../lib/utils'
import { useStaff } from '../hooks/useStaff'
import { useStaffAttendance } from '../hooks/useStaffAttendance'
import type { Staff } from '../types/staff'
import type { StaffAttendance, StaffAttendanceStatus } from '../types/staffAttendance'

const STATUS_LABEL: Record<StaffAttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  leave: 'Leave',
}

const STATUS_CHIP_CLASS: Record<StaffAttendanceStatus, string> = {
  present: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  absent: 'border border-rose-200 bg-rose-50 text-rose-700',
  leave: 'border border-amber-200 bg-amber-50 text-amber-700',
}

const STATUS_BUTTON_CLASS: Record<StaffAttendanceStatus, string> = {
  present: 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100',
  absent: 'border-rose-300 bg-rose-50 text-rose-700 hover:border-rose-400 hover:bg-rose-100',
  leave: 'border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100',
}

type AttendanceCounts = { present: number; absent: number; leave: number }

const EMPTY_COUNTS: AttendanceCounts = { present: 0, absent: 0, leave: 0 }

export default function StaffAttendancePage() {
  const [selectedDate, setSelectedDate] = useState(() => formatDateValue(new Date()))
  const [searchTerm, setSearchTerm] = useState('')

  const monthValue = selectedDate && selectedDate.length >= 7 ? selectedDate.slice(0, 7) : formatMonthValue(new Date())
  const { data: staff, loading: staffLoading, error: staffError } = useStaff()
  const {
    data: attendance,
    loading: attendanceLoading,
    error: attendanceError,
    saveAttendance,
    deleteAttendance,
    refetch,
  } = useStaffAttendance(monthValue)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  const monthMeta = useMemo(() => getMonthMeta(monthValue), [monthValue])

  const staffList = useMemo(() => [...staff].sort((a, b) => a.name.localeCompare(b.name)), [staff])
  const filteredStaff = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return staffList
    return staffList.filter((member) => {
      const nameMatch = member.name.toLowerCase().includes(query)
      const roleMatch = (member.role ?? '').toLowerCase().includes(query)
      return nameMatch || roleMatch
    })
  }, [staffList, searchTerm])

  const dailyStatus = useMemo(() => {
    if (!selectedDate) return new Map<string, StaffAttendanceStatus>()
    const map = new Map<string, StaffAttendanceStatus>()
    for (const entry of attendance) {
      if (toDateKey(entry.date) === selectedDate) {
        map.set(entry.staff_id, entry.status)
      }
    }
    return map
  }, [attendance, selectedDate])

  const countsByStaff = useMemo(() => buildMonthlyCounts(attendance), [attendance])

  const dailySummary = useMemo(() => {
    const ids = new Set(filteredStaff.map((member) => member.id))
    let present = 0
    let absent = 0
    let leave = 0
    for (const [staffId, status] of dailyStatus.entries()) {
      if (!ids.has(staffId)) continue
      if (status === 'present') present += 1
      else if (status === 'absent') absent += 1
      else leave += 1
    }
    const totalStaff = filteredStaff.length
    const totalMarked = present + absent + leave
    const unmarked = Math.max(0, totalStaff - totalMarked)
    return { present, absent, leave, totalStaff, totalMarked, unmarked }
  }, [filteredStaff, dailyStatus])

  const monthlyTotals = useMemo(() => {
    let present = 0
    let absent = 0
    let leave = 0
    for (const member of filteredStaff) {
      const counts = countsByStaff.get(member.id)
      if (!counts) continue
      present += counts.present
      absent += counts.absent
      leave += counts.leave
    }
    const totalMarked = present + absent + leave
    const totalPossible = filteredStaff.length * monthMeta.daysInMonth
    const unmarked = Math.max(0, totalPossible - totalMarked)
    return { present, absent, leave, totalMarked, totalPossible, unmarked }
  }, [filteredStaff, countsByStaff, monthMeta])

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return 'Select a date'
    try {
      return format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')
    } catch {
      return 'Select a date'
    }
  }, [selectedDate])

  const statSubtitle = selectedDate ? selectedDateLabel : 'No date selected'
  const statBase = filteredStaff.length || 1
  const isLoading = staffLoading || attendanceLoading

  const setPendingFor = (id: string, active: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (active) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const stepDay = (delta: number) => {
    const base = selectedDate ? parseSafeDate(selectedDate) : new Date()
    const next = formatDateValue(addDays(base, delta))
    setSelectedDate(next)
  }

  const handleStatusChange = async (member: Staff, status: StaffAttendanceStatus) => {
    if (!selectedDate) {
      toast.error('Choose a date before marking attendance.')
      return
    }
    if (dailyStatus.get(member.id) === status) return
    setPendingFor(member.id, true)
    try {
      const { error } = await saveAttendance({ staffId: member.id, date: selectedDate, status })
      if (error) {
        toast.error(error)
        return
      }
      toast.success(`${member.name} marked ${STATUS_LABEL[status].toLowerCase()} (${formatShortDate(selectedDate)})`)
      await refetch()
    } finally {
      setPendingFor(member.id, false)
    }
  }

  const handleClearStatus = async (member: Staff) => {
    if (!selectedDate) {
      toast.error('Choose a date before clearing attendance.')
      return
    }
    if (!dailyStatus.has(member.id)) return
    setPendingFor(member.id, true)
    try {
      const { error } = await deleteAttendance(member.id, selectedDate)
      if (error) {
        toast.error(error)
        return
      }
      toast.success(`Cleared attendance for ${member.name} (${formatShortDate(selectedDate)})`)
      await refetch()
    } finally {
      setPendingFor(member.id, false)
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Staff attendance</h1>
          <p className="text-sm text-muted-foreground">Mark daily presence quickly and keep a polished attendance trail.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => stepDay(-1)}>Previous day</Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(formatDateValue(new Date()))}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => stepDay(1)}>Next day</Button>
          <Button asChild size="sm">
            <Link to="/staff/attendance-report">Monthly report</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card/80 p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Selected day</div>
            <div className="text-lg font-semibold text-foreground">{selectedDateLabel}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="w-[160px]" />
            <Input placeholder="Search staff or role..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-[220px]" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Viewing {filteredStaff.length} {filteredStaff.length === 1 ? 'staff member' : 'staff members'}</span>
          <span>Month: {monthMeta.label}</span>
          {selectedDate && <span>Marked today: {dailySummary.totalMarked}/{filteredStaff.length}</span>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Present today" value={dailySummary.present} subtitle={`of ${filteredStaff.length || 0} staff`} percent={(dailySummary.present / statBase) * 100} accent="#16a34a" />
        <StatCard title="Absent today" value={dailySummary.absent} subtitle={`of ${filteredStaff.length || 0} staff`} percent={(dailySummary.absent / statBase) * 100} accent="#ef4444" />
        <StatCard title="On leave" value={dailySummary.leave} subtitle={`of ${filteredStaff.length || 0} staff`} percent={(dailySummary.leave / statBase) * 100} accent="#f59e0b" />
        <StatCard title="Not marked" value={dailySummary.unmarked} subtitle={statSubtitle} percent={(dailySummary.unmarked / statBase) * 100} accent="#64748b" />
      </div>

      {staffError && <div className="text-sm text-red-600">{staffError}</div>}
      {attendanceError && <div className="text-sm text-red-600">{attendanceError}</div>}
      {isLoading && filteredStaff.length === 0 && <div className="text-sm text-muted-foreground">Loading attendance...</div>}
      {!isLoading && filteredStaff.length === 0 && <div className="text-sm text-muted-foreground border rounded-md p-4">No staff match the current filters.</div>}

      {filteredStaff.length > 0 && (
        <div className="rounded-2xl border bg-card/90 shadow-sm overflow-hidden">
          <div className="divide-y">
            {filteredStaff.map((member) => {
              const status = dailyStatus.get(member.id)
              const counts = countsByStaff.get(member.id) ?? EMPTY_COUNTS
              const totalMarked = counts.present + counts.absent + counts.leave
              const pendingDays = Math.max(0, monthMeta.daysInMonth - totalMarked)
              const isPending = pendingIds.has(member.id)
              const actionsDisabled = !selectedDate || isPending
              const initials = getInitials(member.name)

              return (
                <div key={member.id} className="px-4 py-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-semibold">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{member.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{member.role || 'No role set'}</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                      <span className={cn('inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold min-h-[28px] min-w-[120px]', status ? STATUS_CHIP_CLASS[status] : 'border border-slate-200 bg-white text-slate-500')}>
                        {status ? STATUS_LABEL[status] : 'Not marked'}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        {(Object.keys(STATUS_LABEL) as Array<StaffAttendanceStatus>).map((value) => (
                          <Button
                            key={value}
                            type="button"
                            size="sm"
                            variant="outline"
                            className={cn(
                              'h-9 rounded-full px-4 text-xs font-semibold transition-colors border-[1.5px]',
                              status === value
                                ? STATUS_BUTTON_CLASS[value]
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            )}
                            disabled={actionsDisabled}
                            onClick={() => handleStatusChange(member, value)}
                          >
                            {STATUS_LABEL[value]}
                          </Button>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-9 rounded-full px-4 text-xs font-semibold border border-dashed border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                          disabled={actionsDisabled || !status}
                          onClick={() => handleClearStatus(member)}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs md:grid-cols-5">
                    <SummaryBadge label="Present" value={counts.present} tone="present" />
                    <SummaryBadge label="Absent" value={counts.absent} tone="absent" />
                    <SummaryBadge label="Leave" value={counts.leave} tone="leave" />
                    <SummaryBadge label="Total marked" value={totalMarked} tone="neutral" />
                    <SummaryBadge label="Pending days" value={pendingDays} tone="muted" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {filteredStaff.length > 0 && (
        <div className="rounded-2xl border bg-card/80 p-5 shadow-sm space-y-3 text-sm">
          <div className="font-semibold text-foreground">Monthly totals - {monthMeta.label}</div>
          <div className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-5">
            <SummaryBadge label="Present days" value={monthlyTotals.present} tone="present" />
            <SummaryBadge label="Absent days" value={monthlyTotals.absent} tone="absent" />
            <SummaryBadge label="Leave days" value={monthlyTotals.leave} tone="leave" />
            <SummaryBadge label="Marked days" value={monthlyTotals.totalMarked} tone="neutral" />
            <SummaryBadge label="Pending days" value={monthlyTotals.unmarked} tone="muted" />
          </div>
          <div className="text-xs text-muted-foreground">Marked {monthlyTotals.totalMarked} of {monthlyTotals.totalPossible} possible staff-days this month.</div>
        </div>
      )}
    </div>
  )
}

type SummaryTone = 'present' | 'absent' | 'leave' | 'neutral' | 'muted'

function SummaryBadge({ label, value, tone }: { label: string; value: number; tone: SummaryTone }) {
  const toneClass: Record<SummaryTone, string> = {
    present: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    absent: 'border border-rose-200 bg-rose-50 text-rose-700',
    leave: 'border border-amber-200 bg-amber-50 text-amber-700',
    neutral: 'border border-primary/40 bg-primary/10 text-primary',
    muted: 'border border-slate-200 bg-slate-100 text-slate-600',
  }
  return (
    <div className={cn('rounded-xl px-3 py-2 flex flex-col gap-1', toneClass[tone])}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/70">{label}</span>
      <span className="text-base font-semibold text-foreground">{value}</span>
    </div>
  )
}

function buildMonthlyCounts(rows: StaffAttendance[]) {
  const map = new Map<string, AttendanceCounts>()
  for (const entry of rows) {
    const current = map.get(entry.staff_id) ?? EMPTY_COUNTS
    const next = { ...current }
    if (entry.status === 'present') next.present += 1
    else if (entry.status === 'absent') next.absent += 1
    else next.leave += 1
    map.set(entry.staff_id, next)
  }
  return map
}

type MonthMeta = {
  year: number
  monthIndex: number
  daysInMonth: number
  firstDay: number
  label: string
  monthString: string
}

function getMonthMeta(value: string): MonthMeta {
  const fallback = formatMonthValue(new Date())
  const target = value && value.length >= 7 ? value : fallback
  const [yearStr, monthStr] = target.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return getMonthMeta(fallback)
  }
  const base = new Date(year, monthIndex, 1)
  return {
    year,
    monthIndex,
    daysInMonth: new Date(year, monthIndex + 1, 0).getDate(),
    firstDay: base.getDay(),
    label: format(base, 'MMMM yyyy'),
    monthString: `${yearStr}-${String(monthIndex + 1).padStart(2, '0')}`,
  }
}

function formatMonthValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 7)
}

function formatDateValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function toDateKey(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string') return value.slice(0, 10)
  if (value && typeof value === 'object' && 'toString' in value) return String(value).slice(0, 10)
  return ''
}

function parseSafeDate(value: string) {
  try {
    return parseISO(value)
  } catch {
    return new Date()
  }
}

function formatShortDate(value: string) {
  try {
    return format(parseISO(value), 'MMM d')
  } catch {
    return value
  }
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'S'
}
