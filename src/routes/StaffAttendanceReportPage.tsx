import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { download, toCsv } from '../lib/csv'
import { printHtml } from '../lib/print'
import { escapeHtml } from '../lib/utils'
import { useStaff } from '../hooks/useStaff'
import { useStaffAttendance } from '../hooks/useStaffAttendance'
import type { Staff } from '../types/staff'
import type { StaffAttendance, StaffAttendanceStatus } from '../types/staffAttendance'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STATUS_LABEL: Record<StaffAttendanceStatus | 'none', string> = {
  present: 'Present',
  absent: 'Absent',
  leave: 'Leave',
  none: 'Not marked',
}
const STATUS_CLASS: Record<StaffAttendanceStatus, string> = {
  present: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  absent: 'border-rose-200 bg-rose-50 text-rose-700',
  leave: 'border-amber-200 bg-amber-50 text-amber-700',
}

export default function StaffAttendanceReportPage() {
  const [month, setMonth] = useState(() => formatMonthValue(new Date()))
  const [staffId, setStaffId] = useState<string>('')

  const { data: staff, error: staffError } = useStaff()
  const { data: attendance, loading, error } = useStaffAttendance(month)

  const monthMeta = useMemo(() => getMonthMeta(month), [month])
  const staffOptions = useMemo(() => [...staff].sort((a, b) => a.name.localeCompare(b.name)), [staff])
  const staffForView = useMemo(() => {
    if (!staffId) return staffOptions
    return staffOptions.filter((s) => s.id === staffId)
  }, [staffOptions, staffId])

  const attendanceByStaff = useMemo(() => buildStatusIndex(attendance), [attendance])
  const countsByStaff = useMemo(() => buildCounts(attendance), [attendance])

  const handleExportCsv = () => {
    if (staffForView.length === 0) return
    const rows: Array<Record<string, string>> = []
    for (const member of staffForView) {
      const statusMap = attendanceByStaff.get(member.id) ?? new Map<string, StaffAttendanceStatus>()
      for (let day = 1; day <= monthMeta.daysInMonth; day += 1) {
        const dayKey = `${monthMeta.monthString}-${String(day).padStart(2, '0')}`
        const status = statusMap.get(dayKey) ?? 'none'
        rows.push({
          staff: member.name,
          date: dayKey,
          status: STATUS_LABEL[status],
        })
      }
    }
    if (rows.length === 0) return
    const slug = staffForView.length === 1 ? slugify(staffForView[0].name) : 'all'
    const filename = `staff_attendance_${monthMeta.monthString}_${slug}.csv`
    download(filename, toCsv(rows, ['staff', 'date', 'status']))
  }

  const handleExportPdf = () => {
    if (staffForView.length === 0) return
    const sections = staffForView
      .map((member) => {
        const statusMap = attendanceByStaff.get(member.id) ?? new Map<string, StaffAttendanceStatus>()
        const counts = countsByStaff.get(member.id) ?? { present: 0, absent: 0, leave: 0 }
        return buildStaffSection({ member, monthMeta, statusMap, counts })
      })
      .join('')
    if (!sections) return
    const styles = getPrintStyles()
    const html = `${styles}<div class="wrapper"><header class="page-header"><div><h1>Staff attendance</h1><p>${escapeHtml(monthMeta.label)}</p></div><span>${new Date().toLocaleString()}</span></header>${sections}</div>`
    printHtml(`Staff attendance - ${monthMeta.label}`, html)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Staff attendance report</h1>
          <p className="text-sm text-muted-foreground">Review monthly attendance patterns and download detailed exports.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/staff">Back to staff</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium uppercase text-muted-foreground mb-1">Staff</label>
            <select className="h-10 border rounded-md px-3 text-sm" value={staffId} onChange={(event) => setStaffId(event.target.value)}>
              <option value="">All staff</option>
              {staffOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase text-muted-foreground mb-1">Month</label>
            <Input type="month" value={monthMeta.monthString} onChange={(event) => setMonth(event.target.value)} className="w-[160px]" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportCsv} disabled={staffForView.length === 0 || attendance.length === 0}>
            Export CSV
          </Button>
          <Button onClick={handleExportPdf} disabled={staffForView.length === 0 || attendance.length === 0}>
            Export PDF
          </Button>
        </div>
      </div>

      {staffError && <div className="text-sm text-red-600">{staffError}</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && attendance.length === 0 && <div className="text-sm text-muted-foreground">Loading attendance...</div>}
      {staffForView.length === 0 && !loading && <div className="text-sm text-muted-foreground border rounded-md p-4">No staff available.</div>}

      <div className="space-y-4">
        {staffForView.map((member) => {
          const statusMap = attendanceByStaff.get(member.id) ?? new Map<string, StaffAttendanceStatus>()
          const counts = countsByStaff.get(member.id) ?? { present: 0, absent: 0, leave: 0 }
          const cells = buildCalendarCells(monthMeta, statusMap)
          return (
            <div key={member.id} className="rounded-2xl border bg-card/90 shadow-sm p-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{member.name}</h2>
                  {member.role && <p className="text-xs text-muted-foreground">{member.role}</p>}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">Present: {counts.present}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">Absent: {counts.absent}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">Leave: {counts.leave}</span>
                </div>
              </div>
              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
                  <span>{monthMeta.label}</span>
                  <div className="flex flex-wrap gap-3">
                    <LegendBadge className="bg-emerald-100 text-emerald-800 border-emerald-200" label="Present" />
                    <LegendBadge className="bg-rose-100 text-rose-800 border-rose-200" label="Absent" />
                    <LegendBadge className="bg-amber-100 text-amber-800 border-amber-200" label="Leave" />
                    <LegendBadge className="bg-slate-100 text-slate-500 border-slate-200" label="Not marked" />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1 text-[11px] font-medium uppercase text-muted-foreground">
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="text-center">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {cells.map((cell) => {
                    if (!cell.day) {
                      return <div key={cell.key} className="aspect-square rounded-lg border border-transparent" />
                    }
                    const status = cell.status
                    const baseClass = 'aspect-square rounded-lg border text-xs font-medium flex items-center justify-center'
                    const className = status ? `${baseClass} ${STATUS_CLASS[status]}` : `${baseClass} border-slate-200 text-slate-400 bg-white`
                    return (
                      <div key={cell.key} className={className} title={`${cell.dateKey} — ${STATUS_LABEL[status ?? 'none']}`}>
                        {cell.day}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LegendBadge({ className, label }: { className: string; label: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${className}`}>{label}</span>
}

function buildStatusIndex(rows: StaffAttendance[]) {
  const map = new Map<string, Map<string, StaffAttendanceStatus>>()
  for (const entry of rows) {
    const key = toDateKey(entry.date)
    if (!key) continue
    const staffMap = map.get(entry.staff_id) ?? new Map<string, StaffAttendanceStatus>()
    staffMap.set(key, entry.status)
    map.set(entry.staff_id, staffMap)
  }
  return map
}

function buildCounts(rows: StaffAttendance[]) {
  const map = new Map<string, { present: number; absent: number; leave: number }>()
  for (const entry of rows) {
    const row = map.get(entry.staff_id) ?? { present: 0, absent: 0, leave: 0 }
    if (entry.status === 'present') row.present += 1
    else if (entry.status === 'absent') row.absent += 1
    else row.leave += 1
    map.set(entry.staff_id, row)
  }
  return map
}

function buildCalendarCells(meta: MonthMeta, statusMap: Map<string, StaffAttendanceStatus>) {
  const cells: Array<{ key: string; day?: number; dateKey?: string; status?: StaffAttendanceStatus }> = []
  for (let i = 0; i < meta.firstDay; i += 1) {
    cells.push({ key: `blank-start-${i}` })
  }
  for (let day = 1; day <= meta.daysInMonth; day += 1) {
    const dayKey = `${meta.monthString}-${String(day).padStart(2, '0')}`
    const status = statusMap.get(dayKey)
    cells.push({ key: dayKey, day, dateKey: dayKey, status })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `blank-end-${cells.length}` })
  }
  return cells
}

function buildStaffSection({ member, monthMeta, statusMap, counts }: { member: Staff; monthMeta: MonthMeta; statusMap: Map<string, StaffAttendanceStatus>; counts: { present: number; absent: number; leave: number } }) {
  const cells = buildCalendarCells(monthMeta, statusMap)
  const rows: string[] = []
  for (let i = 0; i < cells.length; i += 7) {
    const rowCells = cells.slice(i, i + 7)
    const rowHtml = rowCells
      .map((cell) => {
        if (!cell.day) return '<td class="cell empty"></td>'
        const status = cell.status
        const statusClass = status ? `cell status-${status}` : 'cell status-none'
        return `<td class="${statusClass}">${cell.day}</td>`
      })
      .join('')
    rows.push(`<tr>${rowHtml}</tr>`)
  }
  return `
    <section class="card">
      <header class="card-header">
        <div>
          <h2>${escapeHtml(member.name)}</h2>
          ${member.role ? `<p>${escapeHtml(member.role)}</p>` : ''}
        </div>
        <div class="totals">
          <span class="present">Present: ${counts.present}</span>
          <span class="absent">Absent: ${counts.absent}</span>
          <span class="leave">Leave: ${counts.leave}</span>
        </div>
      </header>
      <table class="calendar">
        <thead>
          <tr>${WEEKDAY_LABELS.map((label) => `<th>${label}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    </section>
  `
}

function getPrintStyles() {
  return `
    <style>
      :root { font-family: 'Inter', Arial, sans-serif; color: #0f172a; }
      body { background: #f1f5f9; margin: 0; padding: 32px; }
      .wrapper { max-width: 960px; margin: 0 auto; }
      .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
      .page-header h1 { margin: 0; font-size: 24px; }
      .page-header p { margin: 4px 0 0; font-size: 12px; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; }
      .page-header span { font-size: 12px; color: #475569; }
      .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 20px; margin-bottom: 24px; box-shadow: 0 20px 45px rgba(15,23,42,0.12); }
      .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .card-header h2 { margin: 0; font-size: 18px; }
      .card-header p { margin: 4px 0 0; font-size: 12px; color: #64748b; }
      .card-header .totals { display: flex; gap: 12px; font-size: 12px; }
      .card-header .totals span { padding: 4px 10px; border-radius: 999px; }
      .card-header .totals .present { background: #dcfce7; color: #15803d; }
      .card-header .totals .absent { background: #fee2e2; color: #b91c1c; }
      .card-header .totals .leave { background: #fef3c7; color: #b45309; }
      .calendar { width: 100%; border-collapse: collapse; font-size: 12px; }
      .calendar th { padding: 6px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
      .calendar td { width: 36px; height: 36px; text-align: center; border: 1px solid #e2e8f0; border-radius: 10px; }
      .calendar .status-present { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
      .calendar .status-absent { background: #fee2e2; color: #b91c1c; border-color: #fecdd3; }
      .calendar .status-leave { background: #fef3c7; color: #b45309; border-color: #fde68a; }
      .calendar .status-none { background: #f8fafc; color: #94a3b8; border-color: #e2e8f0; }
      .calendar .empty { border: none; }
    </style>
  `
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

function toDateKey(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string') return value.slice(0, 10)
  if (value && typeof value === 'object' && 'toString' in value) return String(value).slice(0, 10)
  return ''
}

function slugify(value: string) {
  const result = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return result || 'staff'
}
