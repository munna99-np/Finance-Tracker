import { useMemo, useState } from 'react'
import { useParties } from '../hooks/useParties'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import MoneyInput from '../components/fields/MoneyInput'
import ScopeSelect from '../components/fields/ScopeSelect'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { useTransactions } from '../hooks/useTransactions'
import { formatCurrency } from '../lib/format'
import { printHtml } from '../lib/print'
import { escapeHtml } from '../lib/utils'
import { IconTransactions } from '../components/icons'

type EditState = { id: string; name: string; phone: string | null; notes: string | null } | null

export default function PartiesPage() {
  const { data, error, refetch } = useParties()
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [editing, setEditing] = useState<EditState>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter((p) => p.name.toLowerCase().includes(q) || (p.phone ?? '').toLowerCase().includes(q))
  }, [data, search])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Parties</h1>
        <Input className="h-9 w-60" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="flex items-center justify-end">
          <Button
            variant="outline"
            onClick={async () => {
            const [partiesRes, txRes, accRes, catRes] = await Promise.all([
              supabase.from('parties').select('id,name,phone,notes').order('name'),
              supabase
                .from('transactions')
                .select('id,party_id,date,amount,direction,scope,account_id,category_id,notes')
                .not('party_id', 'is', null)
                .order('date', { ascending: true }),
              supabase.from('accounts').select('id,name'),
              supabase.from('categories').select('id,name'),
            ])
            if (partiesRes.error) return toast.error(partiesRes.error.message)
            if (txRes.error) return toast.error(txRes.error.message)
            if (accRes.error) return toast.error(accRes.error.message)
            if (catRes.error) return toast.error(catRes.error.message)

              const parties = (partiesRes.data as any[]) || []
              const txns = (txRes.data as any[]) || []
            const accounts = new Map<string, string>(((accRes.data as any[]) || []).map((a) => [a.id, a.name]))
            const categories = new Map<string, string>(((catRes.data as any[]) || []).map((c) => [c.id, c.name]))

            const byParty = new Map<string, any[]>()
            for (const t of txns) {
              const pid = t.party_id as string
              if (!byParty.has(pid)) byParty.set(pid, [])
              byParty.get(pid)!.push(t)
            }

            const sections: string[] = []
            const sortedParties = parties.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            for (const p of sortedParties) {
              const rows = byParty.get(p.id) || []
              if (rows.length === 0) continue
              let totalIn = 0
              let totalOut = 0
              const body = rows
                .map((t) => {
                  const isIn = t.direction === 'in'
                  const amt = isIn ? t.amount : Math.abs(t.amount)
                  if (isIn) totalIn += amt
                  else totalOut += amt
                  const acct = accounts.get(t.account_id) || ''
                  const cat = t.category_id ? categories.get(t.category_id) || '' : ''
                  const dateStr = (t.date instanceof Date ? t.date.toISOString().slice(0, 10) : String(t.date))
                  const type = isIn ? 'Received' : 'Given'
                    return `<tr>
                    <td>${escapeHtml(dateStr)}</td>
                    <td>${escapeHtml(type)}</td>
                    <td>${escapeHtml(t.scope)}</td>
                    <td>${escapeHtml(acct)}</td>
                    <td>${escapeHtml(cat)}</td>
                    <td class='num'>${formatCurrency(amt)}</td>
                    <td>${escapeHtml(t.notes ?? '')}</td>
                  </tr>`
                  })
                  .join('')
                const net = totalIn - totalOut
                const section = `
                  <div class="card">
                  <div class="card-title">${escapeHtml(p.name)} ${p.phone ? `— ${escapeHtml(p.phone)}` : ''}</div>
                  <div>
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Scope</th>
                          <th>Account</th>
                          <th>Category</th>
                          <th class="num">Amount</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${body}
                        <tr>
                          <td colspan="5"><strong>Totals</strong></td>
                          <td class="num"><strong>${formatCurrency(totalIn)} in / ${formatCurrency(totalOut)} out</strong></td>
                          <td><strong>Net: ${formatCurrency(net)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              `
              sections.push(section)
            }
            const title = 'Party Payment History'
            const html = `
              <div class="header">
                <div class="brand"><div class="badge">Report</div><h1>Parties</h1></div>
                <div class="muted">${new Date().toLocaleString()}</div>
              </div>
              ${sections.join('')}
            `
            printHtml(title, html, { primary: '#2563EB', accent: '#10B981' })
          }}
        >
          Download Payment History
        </Button>
      </div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      <div className="border rounded-md p-3 space-y-2">
        <div className="font-medium">Add Party</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <label className="text-sm">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sita Traders" />
          </div>
          <div>
            <label className="text-sm">Phone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9800…" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <Button
              onClick={async () => {
                const n = name.trim()
                if (!n) return toast.error('Name is required')
                const payload: any = { name: n }
                if (phone.trim()) payload.phone = phone.trim()
                if (notes.trim()) payload.notes = notes.trim()
                const { error } = await supabase.from('parties').insert(payload)
                if (error) return toast.error(error.message)
                toast.success('Party added')
                setName('')
                setPhone('')
                setNotes('')
                await refetch()
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Phone</th>
              <th className="text-left p-2">Notes</th>
              <th className="text-right p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isEditing = editing?.id === p.id
              return (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="p-2">
                    {isEditing ? (
                      <Input value={editing?.name ?? ''} onChange={(e) => setEditing((prev) => prev ? { ...prev, name: e.target.value } : prev)} />
                    ) : (
                      <PartyActionDialog partyId={p.id} partyName={p.name} onCreated={refetch} />
                    )}
                  </td>
                  <td className="p-2">
                    {isEditing ? (
                      <Input value={editing?.phone ?? ''} onChange={(e) => setEditing((prev) => prev ? { ...prev, phone: e.target.value } : prev)} />
                    ) : (
                      p.phone ?? '-'
                    )}
                  </td>
                  <td className="p-2">
                    {isEditing ? (
                      <Input value={editing?.notes ?? ''} onChange={(e) => setEditing((prev) => prev ? { ...prev, notes: e.target.value } : prev)} />
                    ) : (
                      p.notes ?? '-'
                    )}
                  </td>
                  <td className="p-2 text-right space-x-2">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          onClick={async () => {
                            const payload: any = {
                              name: (editing?.name ?? '').trim(),
                              phone: (editing?.phone ?? '') || null,
                              notes: (editing?.notes ?? '') || null,
                            }
                            if (!payload.name) return toast.error('Name is required')
                            const { error } = await supabase.from('parties').update(payload).eq('id', p.id)
                            if (error) return toast.error(error.message)
                            toast.success('Party updated')
                            setEditing(null)
                            await refetch()
                          }}
                        >
                          Save
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEditing({ id: p.id, name: p.name, phone: p.phone ?? '', notes: p.notes ?? '' })}>Edit</Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            const { error } = await supabase.from('parties').delete().eq('id', p.id)
                            if (error) {
                              if (/foreign key|violates/.test(error.message)) {
                                toast.error('Cannot delete: party is used by transactions')
                              } else {
                                toast.error(error.message)
                              }
                              return
                            }
                            toast.success('Party deleted')
                            await refetch()
                          }}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="p-2 text-muted-foreground" colSpan={4}>No parties found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PartyActionDialog({ partyId, partyName, onCreated }: { partyId: string; partyName: string; onCreated: () => void }) {
  const { data: accounts } = useAccounts()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'add' | 'activity'>('add')
  const [type, setType] = useState<'payment_in' | 'payment_out' | 'purchase' | 'sale'>('payment_in')
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [scope, setScope] = useState<'personal' | 'work'>('work')
  const [activityScope, setActivityScope] = useState<'' | 'personal' | 'work'>('')
  const [accountId, setAccountId] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [amount, setAmount] = useState<number | undefined>(undefined)
  const [qty, setQty] = useState<number | undefined>(undefined)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: categories } = useCategories(scope)
  const { data: partyTxns, error: txError, refetch: refetchTx } = useTransactions({ partyId, scope: activityScope || undefined })
  const showCategory = type === 'purchase' || type === 'sale'
  const direction: 'in' | 'out' = (type === 'payment_in' || type === 'sale') ? 'in' : 'out'

  async function submit() {
    if (!accountId) return toast.error('Select account')
    if (!amount || Number.isNaN(amount)) return toast.error('Enter amount')
    const absolute = Math.abs(amount)
    const signed = direction === 'out' ? -absolute : absolute
    const payload: any = {
      account_id: accountId,
      date,
      amount: signed,
      qty: qty ?? null,
      direction,
      scope,
      category_id: showCategory && categoryId ? categoryId : null,
      party_id: partyId,
      notes: notes || null,
    }
    setSaving(true)
    const { error } = await supabase.from('transactions').insert(payload)
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Saved')
    setOpen(false)
    setAmount(undefined)
    setQty(undefined)
    setNotes('')
    setCategoryId('')
    onCreated()
    refetchTx()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="px-2 py-1 rounded-md font-medium text-primary hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          title="Add transaction for this party"
        >
          {partyName}
        </button>
      </DialogTrigger>
      <DialogContent className="bg-white border rounded-md p-4 shadow-xl max-w-2xl w-[95vw]">
        <DialogTitle className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary"><IconTransactions size={16} /></span>
          {partyName}
        </DialogTitle>
        <div className="mb-3 flex items-center gap-2">
          <Button size="sm" variant={tab === 'add' ? 'default' : 'outline'} onClick={() => setTab('add')}>Add Entry</Button>
          <Button size="sm" variant={tab === 'activity' ? 'default' : 'outline'} onClick={() => setTab('activity')}>Activity</Button>
        </div>
        {tab === 'add' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
          <div>
            <label className="text-sm">Type</label>
            <select className="h-9 w-full border rounded-md px-2" value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="payment_in">Payment In</option>
              <option value="payment_out">Payment Out</option>
              <option value="purchase">Purchase</option>
              <option value="sale">Sale</option>
            </select>
          </div>
          <div>
            <label className="text-sm">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Scope</label>
            <ScopeSelect value={scope} onValueChange={setScope} />
          </div>
          <div>
            <label className="text-sm">Account</label>
            <select className="h-9 w-full border rounded-md px-2" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          {showCategory && (
            <div className="md:col-span-2">
              <label className="text-sm">Category</label>
              <select className="h-9 w-full border rounded-md px-2" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-sm">Amount</label>
            <MoneyInput value={amount} onChange={setAmount} />
          </div>
          <div>
            <label className="text-sm">Quantity</label>
            <MoneyInput value={qty} onChange={setQty} />
          </div>
          <div>
            <label className="text-sm">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
        ) : (
          <div>
            {txError && <div className="text-sm text-red-600 mb-2">{txError}</div>}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="inline-flex gap-2">
                <Button size="sm" variant={activityScope === 'personal' ? 'default' : 'outline'} onClick={() => setActivityScope('personal')}>Personal</Button>
                <Button size="sm" variant={activityScope === 'work' ? 'default' : 'outline'} onClick={() => setActivityScope('work')}>Work</Button>
                <Button size="sm" variant={activityScope === '' ? 'default' : 'outline'} onClick={() => setActivityScope('')}>All</Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
              {(() => {
                const totals = partyTxns.reduce((acc: any, t: any) => {
                  if (t.direction === 'in') acc.in += t.amount; else if (t.direction === 'out') acc.out += Math.abs(t.amount)
                  acc.net = acc.in - acc.out; return acc
                }, { in: 0, out: 0, net: 0 })
                return (
                  <>
                    <div className="border rounded-md p-2 bg-green-50">
                      <div className="text-xs text-green-700">Total In</div>
                      <div className="font-semibold">{formatCurrency(totals.in)}</div>
                    </div>
                    <div className="border rounded-md p-2 bg-red-50">
                      <div className="text-xs text-red-700">Total Out</div>
                      <div className="font-semibold">{formatCurrency(totals.out)}</div>
                    </div>
                    <div className="border rounded-md p-2 bg-indigo-50">
                      <div className="text-xs text-indigo-700">Net</div>
                      <div className="font-semibold">{formatCurrency(totals.net)}</div>
                    </div>
                  </>
                )
              })()}
              </div>
            </div>
            <div className="max-h-80 overflow-auto border rounded-md">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Scope</th>
                    <th className="text-right p-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {partyTxns.map((t: any) => {
                    const isIn = t.direction === 'in'
                    const amt = isIn ? t.amount : Math.abs(t.amount)
                    return (
                      <tr key={t.id} className="border-t hover:bg-muted/30">
                        <td className="p-2">{t.date}</td>
                        <td className="p-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${isIn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {isIn ? 'Payment In / Sale' : 'Payment Out / Purchase'}
                          </span>
                        </td>
                        <td className="p-2">{t.scope}</td>
                        <td className={`p-2 text-right font-medium ${isIn ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(amt)}</td>
                      </tr>
                    )
                  })}
                  {partyTxns.length === 0 && (
                    <tr>
                      <td className="p-2 text-muted-foreground" colSpan={4}>No transactions</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
