import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import MoneyInput from '../components/fields/MoneyInput'
import { formatCurrency } from '../lib/format'
import { searchItems, getLatestPurchaseRate } from '../services/inventoryItems'
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog'
import { saveProject, saveEstimate } from '../services/projects'
import { toast } from 'sonner'

type ProjectLine = {
  key: string
  item_id?: string
  name: string
  sku?: string | null
  inStock?: number
  unit?: string | null
  qty?: number
  rate?: number
}

export default function InventoryProjectPage() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSug, setShowSug] = useState(false)
  const [loadingSug, setLoadingSug] = useState(false)
  const [lines, setLines] = useState<ProjectLine[]>([])
  const [focusIdx, setFocusIdx] = useState<number>(-1)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectNotes, setProjectNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Estimate state
  type EstLine = { key: string; name: string; unit?: string | null; qty?: number; rate?: number }
  const [estimateOpen, setEstimateOpen] = useState(false)
  const [estimateLines, setEstimateLines] = useState<EstLine[]>([])
  const [estName, setEstName] = useState('')
  const [estUnit, setEstUnit] = useState('pcs')
  const [estQty, setEstQty] = useState<number | undefined>(1)
  const [estRate, setEstRate] = useState<number | undefined>(0)
  const [estimateSaving, setEstimateSaving] = useState(false)
  const [estimateProjectName, setEstimateProjectName] = useState('')

  // Section ref to scroll from the top button
  const itemsSectionRef = useRef<HTMLDivElement | null>(null)

  // Load suggestions on query change
  useEffect(() => {
    let active = true
    ;(async () => {
      const q = query.trim()
      if (!q) { setSuggestions([]); return }
      setLoadingSug(true)
      try {
        const rows = await searchItems(q)
        if (!active) return
        setSuggestions(rows)
      } finally {
        if (active) setLoadingSug(false)
      }
    })()
    return () => { active = false }
  }, [query])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target as any)) setShowSug(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  const addFromSuggestion = async (it: any) => {
    const rate = await getLatestPurchaseRate(it.id).catch(() => undefined)
    setLines((ls) => [
      ...ls,
      {
        key: cryptoRandomKey(),
        item_id: it.id,
        name: it.name,
        sku: it.sku,
        inStock: Number(it.stock || 0),
        unit: it.unit || 'pcs',
        qty: 1,
        rate: typeof rate === 'number' ? rate : Number(it.price || 0),
      },
    ])
    setQuery('')
    setSuggestions([])
    setShowSug(false)
  }

  const addFreeItem = () => {
    const n = query.trim()
    if (!n) return
    setLines((ls) => [
      ...ls,
      { key: cryptoRandomKey(), name: n, qty: 1, rate: 0, unit: 'pcs' },
    ])
    setQuery('')
    setSuggestions([])
    setShowSug(false)
  }

  const total = useMemo(() => lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.rate || 0), 0), [lines])

  return (
    <div className="space-y-4">
      {/* Top header without Inventory links */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold">Construction Work</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEstimateOpen(true)}>Estimate</Button>
          <Button onClick={() => itemsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Project Items</Button>
        </div>
      </div>

      {/* Estimate Section */}
      <div className="border rounded-md p-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="grow min-w-[16rem]">
            <label className="text-sm">Project Name</label>
            <Input value={estimateProjectName} onChange={(e) => setEstimateProjectName(e.target.value)} placeholder="e.g. Site A – Estimation" />
          </div>
          <div className="ml-auto flex items-end gap-2">
            <Button variant="outline" onClick={() => setEstimateOpen(true)}>Add Entry</Button>
            <Button onClick={async () => {
              const name = estimateProjectName.trim()
              if (!name) return toast.error('Enter Project Name')
              if (estimateLines.length === 0) return toast.error('Add at least one estimate entry')
              setEstimateSaving(true)
              try {
                const res = await saveEstimate({
                  name,
                  lines: estimateLines.map((l) => ({ name: l.name, unit: l.unit || null, qty: Number(l.qty || 0), rate: Number(l.rate || 0) })),
                })
                toast.success(`Estimate saved (${res.stored})`)
                setEstimateLines([]); setEstimateProjectName('')
              } catch (e: any) { toast.error(e.message || 'Failed to save estimate') }
              finally { setEstimateSaving(false) }
            }} disabled={estimateSaving}>{estimateSaving ? 'Saving…' : 'Save Estimate'}</Button>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left w-16">S.N.</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-left">Unit</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Rate</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {estimateLines.map((l, idx) => (
                <tr key={l.key} className="border-t">
                  <td className="p-2">{idx + 1}</td>
                  <td className="p-2 min-w-[16rem]">{l.name}</td>
                  <td className="p-2 w-24"><Input value={l.unit || ''} onChange={(e) => setEstimateLines((ls) => ls.map((x,i) => i===idx ? { ...x, unit: e.target.value } : x))} /></td>
                  <td className="p-2 text-right w-24"><MoneyInput value={l.qty} onChange={(v) => setEstimateLines((ls) => ls.map((x,i) => i===idx ? { ...x, qty: v as number } : x))} /></td>
                  <td className="p-2 text-right w-24"><MoneyInput value={l.rate} onChange={(v) => setEstimateLines((ls) => ls.map((x,i) => i===idx ? { ...x, rate: v as number } : x))} /></td>
                  <td className="p-2 text-right w-28">{(Number(l.qty || 0) * Number(l.rate || 0)).toFixed(2)}</td>
                  <td className="p-2 text-right w-28"><Button size="sm" variant="outline" onClick={() => setEstimateLines((ls) => ls.filter((_, i) => i !== idx))}>Remove</Button></td>
                </tr>
              ))}
              {estimateLines.length === 0 && (
                <tr><td className="p-2 text-muted-foreground" colSpan={7}>No estimate entries</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="p-2 text-right" colSpan={5}>Total</td>
                <td className="p-2 text-right font-medium">{estimateLines.reduce((s,l)=> s + Number(l.qty || 0) * Number(l.rate || 0), 0).toFixed(2)}</td>
                <td className="p-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="border rounded-md p-3" ref={itemsSectionRef}>
        <div className="font-medium mb-2">Project Items</div>
        <div className="flex items-end gap-2 flex-wrap" ref={boxRef}>
          <div className="grow min-w-[16rem] relative">
            <label className="text-sm">Add item</label>
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSug(true); setFocusIdx(-1) }}
              placeholder="Type item name or SKU"
              onFocus={() => setShowSug(true)}
              onKeyDown={(e) => {
                if (!showSug) return
                if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx((i) => Math.min((suggestions.length - 1), i + 1)) }
                if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx((i) => Math.max(-1, i - 1)) }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (focusIdx >= 0 && suggestions[focusIdx]) addFromSuggestion(suggestions[focusIdx])
                  else addFreeItem()
                }
              }}
            />
            {showSug && (query.trim() || loadingSug) && (
              <div className="absolute z-10 left-0 right-0 mt-1 border rounded-md bg-white shadow-sm max-h-60 overflow-auto">
                {loadingSug && <div className="p-2 text-sm text-muted-foreground">Searching…</div>}
                {!loadingSug && suggestions.length === 0 && (
                  <div className="p-2 text-sm">
                    <div className="text-muted-foreground">Not in stock</div>
                    <Button className="mt-1" size="sm" onClick={addFreeItem}>Add “{query.trim()}”</Button>
                  </div>
                )}
                {!loadingSug && suggestions.map((s, idx) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => addFromSuggestion(s)}
                    className={`w-full text-left p-2 text-sm hover:bg-muted/40 ${focusIdx === idx ? 'bg-muted/40' : ''}`}
                  >
                    <div className="font-medium">{s.name} <span className="text-xs text-muted-foreground">{s.sku || ''}</span></div>
                    <div className="text-xs text-muted-foreground">In stock: {Number(s.stock || 0).toFixed(2)} • Price: {formatCurrency(Number(s.price || 0))}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={addFreeItem}>Add</Button>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Item</th>
              <th className="p-2 text-left">SKU</th>
              <th className="p-2 text-right">In stock</th>
              <th className="p-2 text-left">Unit</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Rate</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => (
              <tr key={l.key} className="border-t">
                <td className="p-2 min-w-[14rem]">{l.name}</td>
                <td className="p-2 min-w-[8rem]">{l.sku || '-'}</td>
                <td className="p-2 text-right min-w-[7rem]">{typeof l.inStock === 'number' ? Number(l.inStock).toFixed(2) : '—'}</td>
                <td className="p-2 w-28"><Input value={l.unit || ''} onChange={(e) => setLines((ls) => ls.map((x,i) => i===idx ? { ...x, unit: e.target.value } : x))} placeholder="pcs / kg / bag" /></td>
                <td className="p-2 text-right w-28"><MoneyInput value={l.qty} onChange={(v) => setLines((ls) => ls.map((x,i) => i===idx ? { ...x, qty: v as number } : x))} /></td>
                <td className="p-2 text-right w-28"><MoneyInput value={l.rate} onChange={(v) => setLines((ls) => ls.map((x,i) => i===idx ? { ...x, rate: v as number } : x))} /></td>
                <td className="p-2 text-right w-28">{(Number(l.qty || 0) * Number(l.rate || 0)).toFixed(2)}</td>
                <td className="p-2 text-right w-32">
                  <Button size="sm" variant="outline" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>Remove</Button>
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td className="p-2 text-muted-foreground" colSpan={8}>No items added yet</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="p-2 text-right" colSpan={6}>Total</td>
              <td className="p-2 text-right font-medium">{total.toFixed(2)}</td>
              <td className="p-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setLines([])}>Clear</Button>
        <div className="w-2"></div>
        <Button onClick={() => setSaveOpen(true)} disabled={lines.length === 0}>Save Project</Button>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="bg-white border rounded-md p-4 shadow-xl max-w-md w-[95vw]">
          <DialogTitle>Save Project</DialogTitle>
          <div className="mt-2 space-y-3">
            <div>
              <label className="text-sm">Project name</label>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Villa A – Plumbing" />
            </div>
            <div>
              <label className="text-sm">Notes</label>
              <Input value={projectNotes} onChange={(e) => setProjectNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              const name = projectName.trim()
              if (!name) return toast.error('Project name is required')
              if (lines.length === 0) return toast.error('Add at least one item')
              setSaving(true)
              try {
                const payload = {
                  name,
                  notes: projectNotes.trim() || undefined,
                  lines: lines.map((l) => ({ item_id: l.item_id, name: l.name, sku: l.sku ?? null, unit: l.unit ?? null, qty: Number(l.qty || 0), rate: Number(l.rate || 0) }))
                }
                const res = await saveProject(payload)
                toast.success(`Project saved (${res.stored})`)
                setLines([])
                setProjectName(''); setProjectNotes(''); setSaveOpen(false)
              } catch (e: any) {
                toast.error(e.message || 'Failed to save')
              } finally { setSaving(false) }
            }} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Estimate entry dialog */}
      <Dialog open={estimateOpen} onOpenChange={setEstimateOpen}>
        <DialogContent className="bg-white border rounded-md p-4 shadow-xl max-w-md w-[95vw]">
          <DialogTitle>Add Estimate Entry</DialogTitle>
          <div className="mt-2 space-y-3">
            <div>
              <label className="text-sm">Description</label>
              <Input value={estName} onChange={(e) => setEstName(e.target.value)} placeholder="e.g. Brickwork 9 inch" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm">Unit</label>
                <Input value={estUnit} onChange={(e) => setEstUnit(e.target.value)} placeholder="pcs / sq.ft / bag" />
              </div>
              <div>
                <label className="text-sm">Qty</label>
                <MoneyInput value={estQty} onChange={(v) => setEstQty(v as number)} />
              </div>
              <div>
                <label className="text-sm">Rate</label>
                <MoneyInput value={estRate} onChange={(v) => setEstRate(v as number)} />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEstimateOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              const n = estName.trim()
              if (!n) return toast.error('Description is required')
              setEstimateLines((ls) => [...ls, { key: cryptoRandomKey(), name: n, unit: estUnit || undefined, qty: Number(estQty || 0), rate: Number(estRate || 0) }])
              setEstName(''); setEstUnit('pcs'); setEstQty(1); setEstRate(0); setEstimateOpen(false)
            }}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function cryptoRandomKey() {
  // Works in browser context; fallback if not available
  try {
    const bytes = new Uint8Array(8)
    ;(crypto as any).getRandomValues(bytes)
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return Math.random().toString(36).slice(2)
  }
}
