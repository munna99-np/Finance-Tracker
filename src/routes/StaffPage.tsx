import { useMemo, useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Link } from 'react-router-dom'
import { useStaff } from '../hooks/useStaff'
import { useStaffAdvances } from '../hooks/useStaffAdvances'
import { useStaffSalaries } from '../hooks/useStaffSalaries'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'sonner'
import { formatCurrency } from '../lib/format'
import { escapeHtml } from '../lib/utils'
import { printHtml } from '../lib/print'

type Tab = 'staff' | 'salary' | 'advance' | 'reports'

export default function StaffPage() {
  const [tab, setTab] = useState<Tab>('staff')
  const { data: staff, error: staffError } = useStaff()
  const [selectedStaff, setSelectedStaff] = useState<string>('')
  // Fetch all rows; filter in-memory so Reports and PDF always have full data
  const { data: adv } = useStaffAdvances(undefined)
  const { data: sal } = useStaffSalaries(undefined)

  const summary = useMemo(() => {
    const byStaff = new Map<string, { name: string; advances: number; salaries: number }>()
    // Filter staff list when a specific staff is selected
    const staffList = selectedStaff ? staff.filter(s => s.id === selectedStaff) : staff
    for (const s of staffList) byStaff.set(s.id, { name: s.name, advances: 0, salaries: 0 })
    const advRows = selectedStaff ? adv.filter(a => a.staff_id === selectedStaff) : adv
    const salRows = selectedStaff ? sal.filter(r => r.staff_id === selectedStaff) : sal
    for (const a of advRows) {
      const row = byStaff.get(a.staff_id); if (row) row.advances += Number(a.amount || 0)
    }
    for (const srow of salRows) {
      const row = byStaff.get(srow.staff_id); if (row) row.salaries += Number(srow.amount || 0)
    }
    return Array.from(byStaff.entries()).map(([id, r]) => ({ id, ...r, net: r.salaries + r.advances }))
  }, [staff, adv, sal, selectedStaff])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(['staff','salary','advance','reports'] as Tab[]).map((t) => (
          <Button key={t} variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/staff/attendance">Mark attendance</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/staff/attendance-report">Attendance report</Link>
          </Button>
          <select className="h-9 border rounded-md px-2" value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
            <option value="">All staff</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {tab === 'staff' && <StaffTab />}
      {tab === 'advance' && <AdvancesTab staffId={selectedStaff} />}
      {tab === 'salary' && <SalariesTab staffId={selectedStaff} />}
      {tab === 'reports' && (
        <ReportsTab
          rows={summary}
          onPrint={() => {
            const detailsAdv = (selectedStaff ? adv.filter(a => a.staff_id === selectedStaff) : adv)
            const detailsSal = (selectedStaff ? sal.filter(a => a.staff_id === selectedStaff) : sal)
            const staffName = (selectedStaff && staff.find(s => s.id === selectedStaff)?.name) || 'All Staff'
            const totalAdvances = summary.reduce((s, r) => s + (r.advances || 0), 0)
            const totalSalaries = summary.reduce((s, r) => s + (r.salaries || 0), 0)
            const totalNet = totalSalaries + totalAdvances
            const html = `
              <div class="header">
                <div class="brand"><div class="badge">Report</div><h1>Staff</h1></div>
                <div class="muted">${new Date().toLocaleString()}</div>
              </div>
              <div class="card">
                <div class="card-title">Summary - ${escapeHtml(staffName)}</div>
                <div>
                  <table>
                    <thead><tr><th>Staff</th><th class="num">Advances</th><th class="num">Salaries</th><th class="num">Net</th></tr></thead>
                    <tbody>
                      ${summary.map(r => `<tr><td>${escapeHtml(r.name)}</td><td class='num'>${formatCurrency(r.advances)}</td><td class='num'>${formatCurrency(r.salaries)}</td><td class='num'>${formatCurrency(r.net)}</td></tr>`).join('')}
                      <tr><td><strong>Total</strong></td><td class='num'><strong>${formatCurrency(totalAdvances)}</strong></td><td class='num'><strong>${formatCurrency(totalSalaries)}</strong></td><td class='num'><strong>${formatCurrency(totalNet)}</strong></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="card">
                <div class="card-title">Advances</div>
                <div>
                  <table>
                    <thead><tr><th>Staff</th><th>Date</th><th class="num">Amount</th><th>Notes</th></tr></thead>
                    <tbody>
                      ${detailsAdv.map(a => {
                        const dateStr = a.date instanceof Date ? a.date.toISOString().slice(0,10) : String(a.date)
                        const name = staff.find(s=>s.id===a.staff_id)?.name ?? ''
                        return `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(dateStr)}</td><td class='num'>${formatCurrency(a.amount)}</td><td>${escapeHtml(a.notes ?? '')}</td></tr>`
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="card">
                <div class="card-title">Salaries</div>
                <div>
                  <table>
                    <thead><tr><th>Staff</th><th>Period</th><th class="num">Amount</th><th>Paid On</th><th>Notes</th></tr></thead>
                    <tbody>
                      ${detailsSal.map(r => {
                        const name = staff.find(s=>s.id===r.staff_id)?.name ?? ''
                        const periodStr = r.period instanceof Date ? r.period.toISOString().slice(0,7) : String(r.period).slice(0,7)
                        const paidOn = r.paid_on instanceof Date ? r.paid_on.toISOString().slice(0,10) : (r.paid_on ?? '')
                        return `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(periodStr)}</td><td class='num'>${formatCurrency(r.amount)}</td><td>${escapeHtml(paidOn)}</td><td>${escapeHtml(r.notes ?? '')}</td></tr>`
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>`
            printHtml('Staff Report', html, { primary: '#2563EB', accent: '#10B981' })
          }}
        />
      )}
      {staffError && <div className="text-sm text-red-600">{staffError}</div>}
    </div>
  )
}

function StaffTab() {
  const { data, refetch } = useStaff()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('')
  const [joined, setJoined] = useState('')

  return (
    <div className="space-y-3">
      <div className="border rounded-md p-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <div><label className="text-sm">Name</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="text-sm">Phone</label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div><label className="text-sm">Role</label><Input value={role} onChange={(e) => setRole(e.target.value)} /></div>
        <div><label className="text-sm">Joined</label><Input type="date" value={joined} onChange={(e) => setJoined(e.target.value)} /></div>
        <div className="flex justify-end"><Button onClick={async () => {
          const n = name.trim(); if (!n) return toast.error('Name required')
          const payload: any = { name: n }
          if (phone.trim()) payload.phone = phone.trim()
          if (role.trim()) payload.role = role.trim()
          if (joined) payload.joined_on = joined
          const { error } = await supabase.from('staff').insert(payload)
          if (error) return toast.error(error.message)
          toast.success('Staff added')
          setName(''); setPhone(''); setRole(''); setJoined('')
          await refetch()
        }}>Add</Button></div>
      </div>
      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Phone</th><th className="p-2 text-left">Role</th><th className="p-2 text-left">Joined</th></tr></thead>
          <tbody>
            {data.map(s => (
              <tr key={s.id} className="border-t"><td className="p-2">{s.name}</td><td className="p-2">{s.phone ?? '-'}</td><td className="p-2">{s.role ?? '-'}</td><td className="p-2">{s.joined_on ? (s.joined_on instanceof Date ? s.joined_on.toISOString().slice(0,10) : String(s.joined_on)) : '-'}</td></tr>
            ))}
            {data.length === 0 && <tr><td className="p-2 text-muted-foreground" colSpan={4}>No staff yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdvancesTab({ staffId }: { staffId?: string }) {
  const { data, refetch } = useStaffAdvances(staffId)
  const { data: staff } = useStaff()
  const [sel, setSel] = useState('')
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <div className="space-y-3">
      <div className="border rounded-md p-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <div>
          <label className="text-sm">Staff</label>
          <select className="h-9 border rounded-md px-2 w-full" value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">Select staff</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div><label className="text-sm">Date</label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="text-sm">Amount</label><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="md:col-span-1"><label className="text-sm">Notes</label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="flex justify-end"><Button onClick={async () => {
          if (!sel) return toast.error('Select staff')
          if (!date) return toast.error('Select date')
          const amt = Number(amount); if (!amt || amt <= 0 || Number.isNaN(amt)) return toast.error('Amount invalid')
          const payload: any = { staff_id: sel, date, amount: amt, notes: notes.trim() || null }
          const { error } = await supabase.from('staff_advances').insert(payload)
          if (error) return toast.error(error.message)
          toast.success('Advance recorded')
          setSel(''); setDate(''); setAmount(''); setNotes('')
          await refetch()
        }}>Add</Button></div>
      </div>
      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="p-2 text-left">Staff</th><th className="p-2 text-left">Date</th><th className="p-2 text-right">Amount</th><th className="p-2 text-left">Notes</th></tr></thead>
          <tbody>
            {data.map(a => {
              const name = staff.find(s => s.id === a.staff_id)?.name ?? '—'
              const dateStr = a.date instanceof Date ? a.date.toISOString().slice(0, 10) : String(a.date)
              return <tr key={a.id} className="border-t"><td className="p-2">{name}</td><td className="p-2">{dateStr}</td><td className="p-2 text-right">{formatCurrency(a.amount)}</td><td className="p-2">{a.notes ?? '-'}</td></tr>
            })}
            {data.length === 0 && <tr><td className="p-2 text-muted-foreground" colSpan={4}>No advances</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SalariesTab({ staffId }: { staffId?: string }) {
  const { data, refetch } = useStaffSalaries(staffId)
  const { data: staff } = useStaff()
  const [sel, setSel] = useState('')
  const [period, setPeriod] = useState('')
  const [amount, setAmount] = useState('')
  const [advance, setAdvance] = useState('')
  const [paidOn, setPaidOn] = useState('')
  const [notes, setNotes] = useState('')
  const net = (Number(amount) || 0) + (Number(advance) || 0)

  return (
    <div className="space-y-3">
      <div className="border rounded-md p-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
        <div>
          <label className="text-sm">Staff</label>
          <select className="h-9 border rounded-md px-2 w-full" value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">Select staff</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div><label className="text-sm">Period (month)</label><Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
        <div><label className="text-sm">Salary Amount</label><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><label className="text-sm">Advance (optional)</label><Input inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} /></div>
        <div><label className="text-sm">Paid on</label><Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></div>
        <div className="md:col-span-1"><label className="text-sm">Notes</label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="flex items-end justify-end gap-3">
          <div className="text-sm text-muted-foreground">Net to record: {formatCurrency(net || 0)}</div>
          <Button onClick={async () => {
          if (!sel) return toast.error('Select staff')
          if (!period) return toast.error('Select period')
          const amt = Number(amount); if (Number.isNaN(amt) || amt < 0) return toast.error('Amount invalid')
          const advAmt = Number(advance || '0'); if (Number.isNaN(advAmt) || advAmt < 0) return toast.error('Advance invalid')
          // Convert month input (YYYY-MM) to first day date
          const periodDate = `${period}-01`
          const payload: any = { staff_id: sel, period: periodDate, amount: amt, paid_on: paidOn || null, notes: notes.trim() || null }
          const { error } = await supabase.from('staff_salaries').insert(payload)
          if (error) return toast.error(error.message)
          // Optionally create an advance record in the same flow
          if (advAmt > 0) {
            const advPayload: any = {
              staff_id: sel,
              date: (paidOn && paidOn.length >= 10) ? paidOn : new Date().toISOString().slice(0,10),
              amount: advAmt,
              notes: (notes ? notes + ' | ' : '') + `Advance with salary (${period})`,
            }
            const { error: advError } = await supabase.from('staff_advances').insert(advPayload)
            if (advError) return toast.error(`Salary saved, but advance failed: ${advError.message}`)
          }
          toast.success(`Recorded. Net: ${formatCurrency(amt + advAmt)}`)
          setSel(''); setPeriod(''); setAmount(''); setAdvance(''); setPaidOn(''); setNotes('')
          await refetch()
        }}>Add</Button>
        </div>
      </div>
      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="p-2 text-left">Staff</th><th className="p-2 text-left">Period</th><th className="p-2 text-right">Amount</th><th className="p-2 text-left">Paid on</th><th className="p-2 text-left">Notes</th></tr></thead>
          <tbody>
            {data.map(r => {
              const name = staff.find(s => s.id === r.staff_id)?.name ?? '—'
              const period = r.period instanceof Date ? r.period.toISOString().slice(0, 7) : String(r.period).slice(0, 7)
              const paidOnStr = r.paid_on instanceof Date ? r.paid_on.toISOString().slice(0,10) : (r.paid_on ?? '-')
              return <tr key={r.id} className="border-t"><td className="p-2">{name}</td><td className="p-2">{period}</td><td className="p-2 text-right">{formatCurrency(r.amount)}</td><td className="p-2">{paidOnStr}</td><td className="p-2">{r.notes ?? '-'}</td></tr>
            })}
            {data.length === 0 && <tr><td className="p-2 text-muted-foreground" colSpan={5}>No salaries</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReportsTab({ rows, onPrint }: { rows: Array<{ id: string; name: string; advances: number; salaries: number; net: number }>; onPrint: () => void }) {
  const totals = useMemo(() => {
    const advances = rows.reduce((s, r) => s + (r.advances || 0), 0)
    const salaries = rows.reduce((s, r) => s + (r.salaries || 0), 0)
    const net = salaries + advances
    return { advances, salaries, net }
  }, [rows])
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button onClick={onPrint}>Download PDF</Button></div>
      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="p-2 text-left">Staff</th><th className="p-2 text-right">Advances</th><th className="p-2 text-right">Salaries</th><th className="p-2 text-right">Net</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t"><td className="p-2">{r.name}</td><td className="p-2 text-right">{formatCurrency(r.advances)}</td><td className="p-2 text-right">{formatCurrency(r.salaries)}</td><td className="p-2 text-right">{formatCurrency(r.net)}</td></tr>
            ))}
            {rows.length === 0 && <tr><td className="p-2 text-muted-foreground" colSpan={4}>No data</td></tr>}
            {rows.length > 0 && (
              <tr className="border-t font-semibold bg-muted/30">
                <td className="p-2">Total</td>
                <td className="p-2 text-right">{formatCurrency(totals.advances)}</td>
                <td className="p-2 text-right">{formatCurrency(totals.salaries)}</td>
                <td className="p-2 text-right">{formatCurrency(totals.net)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
