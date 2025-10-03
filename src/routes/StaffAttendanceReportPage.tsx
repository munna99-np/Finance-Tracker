import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { StatCard } from '../components/ui/stat-card'
import { download } from '../lib/csv'
import { printHtml } from '../lib/print'
import { escapeHtml, cn } from '../lib/utils'
import { useStaff } from '../hooks/useStaff'
import { useStaffAttendance } from '../hooks/useStaffAttendance'
import type { Staff } from '../types/staff'
import type { StaffAttendance, StaffAttendanceStatus } from '../types/staffAttendance'

const STATUS_LABEL: Record<StaffAttendanceStatus | 'none', string> = {
  present: 'Present',
  absent: 'Absent',
  leave: 'Leave',
  none: 'Not marked',
}

const STATUS_SYMBOL: Record<StaffAttendanceStatus, string> = {
  present: 'P',
  absent: 'A',
  leave: 'L',
}

const STATUS_CELL_CLASS: Record<StaffAttendanceStatus, string> = {
  present: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  absent: 'border-rose-200 bg-rose-50 text-rose-700',
  leave: 'border-amber-200 bg-amber-50 text-amber-700',
}

const STATUS_PDF_CLASS: Record<StaffAttendanceStatus, string> = {
  present: 'status-present',
  absent: 'status-absent',
  leave: 'status-leave',
}

type MonthlySummary = {
  present: number
  absent: number
  leave: number
  totalMarked: number
  totalPossible: number
  pending: number
}

type DayMeta = {
  key: string
  day: number
  weekday: string
  label: string
}

type TableRow = {
  member: Staff
  statuses: Array<StaffAttendanceStatus | null>
  counts: { present: number; absent: number; leave: number }
  totalMarked: number
  pending: number
}

export default function StaffAttendanceReportPage() {
  const [month, setMonth] = useState(() => formatMonthValue(new Date()))
  const [staffId, setStaffId] = useState<string>('')

  const { data: staff, error: staffError } = useStaff()
  const { data: attendance, loading, error } = useStaffAttendance(month)

  const monthMeta = useMemo(() => getMonthMeta(month), [month])
  const days = useMemo(() => buildDayList(monthMeta), [monthMeta])
  const staffOptions = useMemo(() => [...staff].sort((a, b) => a.name.localeCompare(b.name)), [staff])
  const staffForView = useMemo(() => {
    if (!staffId) return staffOptions
    return staffOptions.filter((s) => s.id === staffId)
  }, [staffOptions, staffId])

  const attendanceByStaff = useMemo(() => buildStatusIndex(attendance), [attendance])
  const countsByStaff = useMemo(() => buildCounts(attendance), [attendance])
  const tableRows = useMemo<TableRow[]>(() => {
    return staffForView.map((member) => {
      const statusMap = attendanceByStaff.get(member.id) ?? new Map<string, StaffAttendanceStatus>()
      const counts = countsByStaff.get(member.id) ?? { present: 0, absent: 0, leave: 0 }
      const statuses = days.map((day) => statusMap.get(day.key) ?? null)
      const totalMarked = counts.present + counts.absent + counts.leave
      const pending = Math.max(0, monthMeta.daysInMonth - totalMarked)
      return { member, statuses, counts, totalMarked, pending }
    })
  }, [staffForView, attendanceByStaff, countsByStaff, days, monthMeta.daysInMonth])

  const monthlySummary = useMemo(
    () => buildMonthlySummary(staffForView, countsByStaff, monthMeta),
    [staffForView, countsByStaff, monthMeta]
  )

  const handleExportExcel = () => {
    if (tableRows.length === 0) return
    const slug = staffForView.length === 1 ? slugify(staffForView[0].name) : 'all'
    const filename = `staff_attendance_${monthMeta.monthString}_${slug}.xls`
    const excel = buildExcelXml({ monthLabel: monthMeta.label, days, rows: tableRows })
    download(filename, excel, 'application/vnd.ms-excel')
  }

  const handleExportPdf = () => {
    if (tableRows.length === 0) return
    const table = buildPdfTable({ monthLabel: monthMeta.label, days, rows: tableRows })
    const styles = getPrintStyles()
    const html = `${styles}<div class="wrapper"><header class="page-header"><div><h1>Staff attendance</h1><p>${escapeHtml(monthMeta.label)}</p></div><span>${new Date().toLocaleString()}</span></header>${table}</div>`
    printHtml(`Staff attendance - ${monthMeta.label}`, html)
  }

  const summaryBase = monthlySummary.totalPossible || 1

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Staff attendance report</h1>
          <p className="text-sm text-muted-foreground">Review monthly attendance at a glance and export polished reports.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/staff">Back to staff</Link>
        </Button>
      </div>

      <div className="rounded-2xl border bg-card/80 p-4 space-y-4 shadow-sm">
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
            <Button variant="outline" onClick={handleExportExcel} disabled={tableRows.length === 0}>
              Export Excel
            </Button>
            <Button onClick={handleExportPdf} disabled={tableRows.length === 0}>
              Export PDF
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Viewing {staffForView.length} {staffForView.length === 1 ? 'staff member' : 'staff members'}</span>
          <span>Month: {monthMeta.label}</span>
          <span>Marked days: {monthlySummary.totalMarked}/{monthlySummary.totalPossible}</span>
          <span>Pending days: {monthlySummary.pending}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Present days" value={monthlySummary.present} subtitle={`Out of ${monthlySummary.totalPossible} staff-days`} percent={(monthlySummary.present / summaryBase) * 100} accent="#16a34a" />
        <StatCard title="Absent days" value={monthlySummary.absent} subtitle={`Out of ${monthlySummary.totalPossible} staff-days`} percent={(monthlySummary.absent / summaryBase) * 100} accent="#ef4444" />
        <StatCard title="Leave days" value={monthlySummary.leave} subtitle={`Out of ${monthlySummary.totalPossible} staff-days`} percent={(monthlySummary.leave / summaryBase) * 100} accent="#f59e0b" />
        <StatCard title="Pending days" value={monthlySummary.pending} subtitle={`Out of ${monthlySummary.totalPossible} staff-days`} percent={(monthlySummary.pending / summaryBase) * 100} accent="#64748b" />
      </div>

      {staffError && <div className="text-sm text-red-600">{staffError}</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && attendance.length === 0 && <div className="text-sm text-muted-foreground">Loading attendance...</div>}
      {staffForView.length === 0 && !loading && <div className="text-sm text-muted-foreground border rounded-md p-4">No staff available.</div>}

      {tableRows.length > 0 && (
        <div className="overflow-auto rounded-2xl border bg-card/90 shadow-sm">
          <table className="min-w-[720px] text-xs">
            <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left text-xs font-semibold text-foreground">Staff</th>
                {days.map((day) => (
                  <th key={day.key} className="px-2 py-2 text-center font-semibold text-muted-foreground">
                    <div className="leading-tight">
                      <div className="text-xs font-semibold text-foreground">{day.day}</div>
                      <div className="text-[10px] text-muted-foreground">{day.weekday}</div>
                    </div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-semibold text-muted-foreground">P</th>
                <th className="px-2 py-2 text-center font-semibold text-muted-foreground">A</th>
                <th className="px-2 py-2 text-center font-semibold text-muted-foreground">L</th>
                <th className="px-2 py-2 text-center font-semibold text-muted-foreground">Total</th>
                <th className="px-2 py-2 text-center font-semibold text-muted-foreground">Pending</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.member.id} className="border-t">
                  <td className="sticky left-0 bg-card/90 px-3 py-2 text-left align-top">
                    <div className="text-sm font-semibold text-foreground">{row.member.name}</div>
                    {row.member.role && <div className="text-[11px] text-muted-foreground">{row.member.role}</div>}
                  </td>
                  {row.statuses.map((status, index) => {
                    const symbol = status ? STATUS_SYMBOL[status] : ''
                    const className = status ? STATUS_CELL_CLASS[status] : 'border-slate-200 bg-white text-slate-400'
                    return (
                      <td key={`${row.member.id}-${days[index].key}`} className="px-1 py-1 text-center align-middle">
                        <span
                          className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold', className)}
                          title={`${days[index].label} - ${STATUS_LABEL[status ?? 'none']}`}
                        >
                          {symbol || '-'}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-2 py-1 text-center font-semibold text-emerald-700">{row.counts.present}</td>
                  <td className="px-2 py-1 text-center font-semibold text-rose-600">{row.counts.absent}</td>
                  <td className="px-2 py-1 text-center font-semibold text-amber-600">{row.counts.leave}</td>
                  <td className="px-2 py-1 text-center font-semibold text-slate-700">{row.totalMarked}</td>
                  <td className="px-2 py-1 text-center font-semibold text-slate-500">{row.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function buildMonthlySummary(staff: Staff[], countsByStaff: Map<string, { present: number; absent: number; leave: number }>, monthMeta: MonthMeta): MonthlySummary {
  let present = 0
  let absent = 0
  let leave = 0
  for (const member of staff) {
    const counts = countsByStaff.get(member.id)
    if (!counts) continue
    present += counts.present
    absent += counts.absent
    leave += counts.leave
  }
  const totalMarked = present + absent + leave
  const totalPossible = staff.length * monthMeta.daysInMonth
  const pending = Math.max(0, totalPossible - totalMarked)
  return { present, absent, leave, totalMarked, totalPossible, pending }
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
    const current = map.get(entry.staff_id) ?? { present: 0, absent: 0, leave: 0 }
    const next = { ...current }
    if (entry.status === 'present') next.present += 1
    else if (entry.status === 'absent') next.absent += 1
    else next.leave += 1
    map.set(entry.staff_id, next)
  }
  return map
}

function buildDayList(monthMeta: MonthMeta): DayMeta[] {
  const days: DayMeta[] = []
  for (let day = 1; day <= monthMeta.daysInMonth; day += 1) {
    const date = new Date(monthMeta.year, monthMeta.monthIndex, day)
    days.push({
      key: `${monthMeta.monthString}-${String(day).padStart(2, '0')}`,
      day,
      weekday: format(date, 'EEE'),
      label: format(date, 'MMM d, yyyy'),
    })
  }
  return days
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

function buildPdfTable({ monthLabel, days, rows }: { monthLabel: string; days: DayMeta[]; rows: TableRow[] }) {
  const header = `
    <thead>
      <tr>
        <th class="name-col">Staff</th>
        ${days
          .map(
            (day) =>
              `<th><div class="day-header"><span>${day.day}</span><small>${day.weekday}</small></div></th>`
          )
          .join('')}
        <th>P</th>
        <th>A</th>
        <th>L</th>
        <th>Total</th>
        <th>Pending</th>
      </tr>
    </thead>
  `
  const body = rows
    .map((row) => {
      const nameCell = `
        <td class="name">
          <div>${escapeHtml(row.member.name)}</div>
          ${row.member.role ? `<div class="role">${escapeHtml(row.member.role)}</div>` : ''}
        </td>
      `
      const dayCells = row.statuses
        .map((status, index) => {
          const symbol = status ? STATUS_SYMBOL[status] : ''
          const statusClass = status ? STATUS_PDF_CLASS[status] : 'status-none'
          const title = `${escapeHtml(days[index].label)} - ${STATUS_LABEL[status ?? 'none']}`
          return `<td><span class="status ${statusClass}" title="${title}">${symbol || ''}</span></td>`
        })
        .join('')
      return `
        <tr>
          ${nameCell}
          ${dayCells}
          <td><strong>${row.counts.present}</strong></td>
          <td><strong>${row.counts.absent}</strong></td>
          <td><strong>${row.counts.leave}</strong></td>
          <td><strong>${row.totalMarked}</strong></td>
          <td><strong>${row.pending}</strong></td>
        </tr>
      `
    })
    .join('')
  return `
    <div class="table-card">
      <div class="table-title">${escapeHtml(monthLabel)}</div>
      <table class="report-table">
        ${header}
        <tbody>${body}</tbody>
      </table>
    </div>
  `
}

function buildExcelXml({ monthLabel, days, rows }: { monthLabel: string; days: DayMeta[]; rows: TableRow[] }) {
  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  const statusStyle: Record<StaffAttendanceStatus, string> = {
    present: 'sPresent',
    absent: 'sAbsent',
    leave: 'sLeave',
  }
  const headerRow = `
    <Row>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">Staff</Data></Cell>
      ${days.map((day) => `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escape(String(day.day))}</Data></Cell>`).join('')}
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">P</Data></Cell>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">A</Data></Cell>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">L</Data></Cell>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">Total</Data></Cell>
      <Cell ss:StyleID="sHeader"><Data ss:Type="String">Pending</Data></Cell>
    </Row>
  `
  const bodyRows = rows
    .map((row) => {
      const name = escape(row.member.name)
      const role = row.member.role ? ` (${escape(row.member.role)})` : ''
      const dayCells = row.statuses
        .map((status) => {
          if (!status) {
            return '<Cell ss:StyleID="sBlank"><Data ss:Type="String"></Data></Cell>'
          }
          return `<Cell ss:StyleID="${statusStyle[status]}"><Data ss:Type="String">${STATUS_SYMBOL[status]}</Data></Cell>`
        })
        .join('')
      return `
        <Row>
          <Cell ss:StyleID="sName"><Data ss:Type="String">${name}${role}</Data></Cell>
          ${dayCells}
          <Cell ss:StyleID="sNumber"><Data ss:Type="Number">${row.counts.present}</Data></Cell>
          <Cell ss:StyleID="sNumber"><Data ss:Type="Number">${row.counts.absent}</Data></Cell>
          <Cell ss:StyleID="sNumber"><Data ss:Type="Number">${row.counts.leave}</Data></Cell>
          <Cell ss:StyleID="sNumber"><Data ss:Type="Number">${row.totalMarked}</Data></Cell>
          <Cell ss:StyleID="sPending"><Data ss:Type="Number">${row.pending}</Data></Cell>
        </Row>
      `
    })
    .join('')
  const columnCount = 1 + days.length + 5
  const mergeAcross = columnCount - 1
  return `<?xml version="1.0"?>
  <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
    <Styles>
      <Style ss:ID="sTitle">
        <Font ss:Bold="1" ss:Size="14" />
        <Alignment ss:Horizontal="Center" />
      </Style>
      <Style ss:ID="sHeader">
        <Font ss:Bold="1" />
        <Alignment ss:Horizontal="Center" ss:Vertical="Center" />
        <Interior ss:Color="#E2E8F0" ss:Pattern="Solid" />
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" />
        </Borders>
      </Style>
      <Style ss:ID="sName">
        <Alignment ss:Vertical="Center" />
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" />
        </Borders>
      </Style>
      <Style ss:ID="sNumber">
        <Alignment ss:Horizontal="Center" ss:Vertical="Center" />
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" />
        </Borders>
      </Style>
      <Style ss:ID="sPending">
        <Alignment ss:Horizontal="Center" ss:Vertical="Center" />
        <Font ss:Color="#475569" />
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" />
        </Borders>
      </Style>
      <Style ss:ID="sBlank">
        <Alignment ss:Horizontal="Center" ss:Vertical="Center" />
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" />
        </Borders>
      </Style>
      <Style ss:ID="sPresent">
        <Alignment ss:Horizontal="Center" ss:Vertical="Center" />
        <Interior ss:Color="#DCFCE7" ss:Pattern="Solid" />
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" />
        </Borders>
      </Style>
      <Style ss:ID="sAbsent">
        <Alignment ss:Horizontal="Center" ss:Vertical="Center" />
        <Interior ss:Color="#FEE2E2" ss:Pattern="Solid" />
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" />
        </Borders>
      </Style>
      <Style ss:ID="sLeave">
        <Alignment ss:Horizontal="Center" ss:Vertical="Center" />
        <Interior ss:Color="#FEF3C7" ss:Pattern="Solid" />
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" />
          <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" />
        </Borders>
      </Style>
    </Styles>
    <Worksheet ss:Name="Attendance">
      <Table>
        <Row>
          <Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="sTitle"><Data ss:Type="String">Staff attendance - ${escape(monthLabel)}</Data></Cell>
        </Row>
        ${headerRow}
        ${bodyRows}
      </Table>
    </Worksheet>
  </Workbook>`
}

function getPrintStyles() {
  return `
    <style>
      :root { font-family: 'Inter', Arial, sans-serif; color: #0f172a; }
      body { background: #f1f5f9; margin: 0; padding: 32px; }
      .wrapper { max-width: 1080px; margin: 0 auto; }
      .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
      .page-header h1 { margin: 0; font-size: 24px; }
      .page-header p { margin: 4px 0 0; font-size: 12px; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; }
      .page-header span { font-size: 12px; color: #475569; }
      .table-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 20px; box-shadow: 0 20px 45px rgba(15,23,42,0.12); }
      .table-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
      .report-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .report-table thead th { background: #f8fafc; color: #475569; font-weight: 600; padding: 6px 4px; text-align: center; text-transform: uppercase; letter-spacing: 0.05em; }
      .report-table tbody td { border-top: 1px solid #e2e8f0; padding: 6px 4px; text-align: center; }
      .report-table tbody td.name { text-align: left; font-weight: 600; color: #0f172a; }
      .report-table tbody td.name .role { font-weight: 400; font-size: 11px; color: #64748b; margin-top: 2px; }
      .day-header { display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .day-header span { font-size: 12px; font-weight: 600; color: #0f172a; }
      .day-header small { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
      .status { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; min-height: 22px; border-radius: 6px; border: 1px solid #e2e8f0; font-weight: 600; }
      .status-present { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
      .status-absent { background: #fee2e2; color: #b91c1c; border-color: #fecdd3; }
      .status-leave { background: #fef3c7; color: #b45309; border-color: #fde68a; }
      .status-none { background: #ffffff; color: #94a3b8; border-color: #e2e8f0; }
    </style>
  `
}
