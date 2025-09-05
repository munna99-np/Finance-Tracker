import { supabase } from '../lib/supabaseClient'

export type ProjectLineInput = {
  item_id?: string
  name: string
  sku?: string | null
  unit?: string | null
  qty: number
  rate: number
}

export async function saveProject(params: { name: string; notes?: string; lines: ProjectLineInput[] }) {
  const total = params.lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.rate || 0), 0)
  // Try Supabase persistence first
  try {
    const { data: proj, error } = await supabase
      .from('projects')
      .insert({ name: params.name, notes: params.notes || null, total_amount: total })
      .select('id')
      .single()
    if (error) throw error
    const projectId = proj!.id as string
    const items = params.lines.map((l) => ({
      project_id: projectId,
      item_id: l.item_id || null,
      name: l.name,
      sku: l.sku || null,
      unit: l.unit || null,
      qty: Number(l.qty || 0),
      rate: Number(l.rate || 0),
      amount: Number(l.qty || 0) * Number(l.rate || 0),
    }))
    const { error: e2 } = await supabase.from('project_items').insert(items)
    if (e2) throw e2
    return { id: projectId, stored: 'supabase' as const }
  } catch {
    // Fallback: localStorage persistence
    try {
      const key = 'projects'
      const id = genId()
      const now = new Date().toISOString()
      const rec = { id, name: params.name, notes: params.notes || null, total_amount: total, created_at: now, lines: params.lines }
      const prev = JSON.parse(localStorage.getItem(key) || '[]')
      prev.unshift(rec)
      localStorage.setItem(key, JSON.stringify(prev))
      return { id, stored: 'local' as const }
    } catch {
      throw new Error('Failed to save project')
    }
  }
}

export type EstimateLineInput = {
  name: string
  unit?: string | null
  qty: number
  rate: number
}

export async function saveEstimate(params: { name: string; notes?: string; lines: EstimateLineInput[] }) {
  const total = params.lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.rate || 0), 0)
  try {
    const { data: est, error } = await supabase
      .from('estimates')
      .insert({ name: params.name, notes: params.notes || null, total_amount: total })
      .select('id')
      .single()
    if (error) throw error
    const estimateId = est!.id as string
    const rows = params.lines.map((l, idx) => ({
      estimate_id: estimateId,
      sn: idx + 1,
      name: l.name,
      unit: l.unit || null,
      qty: Number(l.qty || 0),
      rate: Number(l.rate || 0),
      amount: Number(l.qty || 0) * Number(l.rate || 0),
    }))
    const { error: e2 } = await supabase.from('estimate_items').insert(rows)
    if (e2) throw e2
    return { id: estimateId, stored: 'supabase' as const }
  } catch {
    try {
      const key = 'estimates'
      const id = genId()
      const now = new Date().toISOString()
      const rec = { id, name: params.name, notes: params.notes || null, total_amount: total, created_at: now, lines: params.lines }
      const prev = JSON.parse(localStorage.getItem(key) || '[]')
      prev.unshift(rec)
      localStorage.setItem(key, JSON.stringify(prev))
      return { id, stored: 'local' as const }
    } catch {
      throw new Error('Failed to save estimate')
    }
  }
}

function genId() {
  try {
    const bytes = new Uint8Array(8)
    ;(crypto as any).getRandomValues(bytes)
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return Math.random().toString(36).slice(2)
  }
}
