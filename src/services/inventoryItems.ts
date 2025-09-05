import { supabase } from '../lib/supabaseClient'
import { toCsv, download } from '../lib/csv'

export type Item = {
  id: string
  subcategory_id: string
  name: string
  sku: string | null
  unit: string | null
  price: number
  stock: number
  min_stock: number
  max_stock?: number | null
  notes?: string | null
}

export type ItemInput = {
  subcategory_id: string
  name: string
  sku?: string | null
  price?: number
  stock?: number
  unit?: string | null
  min_stock?: number
  max_stock?: number
  notes?: string | null
}

export type ItemUpdate = Partial<Omit<Item, 'id' | 'subcategory_id'>> & { subcategory_id?: string }

// 2. Item Management
export async function addItem(
  subcategoryId: string,
  name: string,
  sku?: string | null,
  price: number = 0,
  stock: number = 0,
  minStock?: number,
  options?: { unit?: string | null; maxStock?: number; notes?: string | null }
) {
  const payload: ItemInput = { subcategory_id: subcategoryId, name: name.trim(), sku: sku || null, price, stock }
  if (typeof minStock === 'number' && !Number.isNaN(minStock)) (payload as any).min_stock = minStock
  if (options?.unit !== undefined) payload.unit = options.unit
  if (options?.maxStock !== undefined) (payload as any).max_stock = options.maxStock
  if (options?.notes !== undefined) payload.notes = options.notes
  if (!payload.name) throw new Error('Name is required')
  const doInsert = async (body: any) => supabase.from('inventory_items').insert(body).select('*').single()
  let { data, error } = await doInsert(payload)
  if (error && String(error.message || '').toLowerCase().includes('max_stock') && String(error.message || '').toLowerCase().includes('does not exist')) {
    // Retry without max_stock if column not present in DB
    const clone = { ...payload } as any
    delete clone.max_stock
    ;({ data, error } = await doInsert(clone))
  }
  if (error) throw new Error(error.message)
  return data as Item
}

export async function updateItem(id: string, updates: ItemUpdate) {
  const payload: any = { ...updates }
  if (typeof payload.name === 'string') payload.name = payload.name.trim()
  const run = async (body: any) => supabase.from('inventory_items').update(body).eq('id', id)
  let { error } = await run(payload)
  if (error && String(error.message || '').toLowerCase().includes('max_stock') && String(error.message || '').toLowerCase().includes('does not exist')) {
    const clone = { ...payload }
    delete (clone as any).max_stock
    ;({ error } = await run(clone))
  }
  if (error) throw new Error(error.message)
}

export async function deleteItem(id: string) {
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getItem(id: string) {
  const run = (fields: string) => supabase
    .from('inventory_items')
    .select(fields)
    .eq('id', id)
    .single()
  let { data, error } = await run('id,subcategory_id,name,sku,unit,price,stock,min_stock,max_stock,notes, subcategory:inventory_subcategories(id,name, category:inventory_categories(id,name))')
  if (error && String(error.message || '').toLowerCase().includes('max_stock') && String(error.message || '').toLowerCase().includes('does not exist')) {
    ;({ data, error } = await run('id,subcategory_id,name,sku,unit,price,stock,min_stock,notes, subcategory:inventory_subcategories(id,name, category:inventory_categories(id,name))'))
  }
  if (error) throw new Error(error.message)
  return data
}

export async function listItems(subcategoryId?: string) {
  let q = supabase.from('inventory_items').select('*')
  if (subcategoryId) q = q.eq('subcategory_id', subcategoryId)
  q = q.order('created_at', { ascending: false })
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data || []) as Item[]
}

// 3. Stock & Purchase Operations
export async function purchaseItem(itemId: string, quantity: number, partyName: string, pricePerUnit: number) {
  if (quantity <= 0) throw new Error('Quantity must be > 0')
  const partyNameTrim = partyName.trim()
  if (!partyNameTrim) throw new Error('Party name is required')

  // Ensure party exists (unique on name)
  const { data: existing } = await supabase.from('parties').select('id').eq('name', partyNameTrim).maybeSingle()
  let partyId = existing?.id
  if (!partyId) {
    const { data: p, error: pe } = await supabase.from('parties').insert({ name: partyNameTrim }).select('id').single()
    if (pe) throw new Error(pe.message)
    partyId = p!.id
  }

  // Create purchase and line (trigger increases stock)
  const total = Number(quantity) * Number(pricePerUnit)
  const { data: purchase, error: e1 } = await supabase
    .from('inventory_purchases')
    .insert({ party_id: partyId, total_amount: total })
    .select('id')
    .single()
  if (e1) throw new Error(e1.message)

  const { error: e2 } = await supabase
    .from('inventory_purchase_items')
    .insert({ purchase_id: purchase!.id, item_id: itemId, qty: quantity, rate: pricePerUnit })
  if (e2) throw new Error(e2.message)

  return { purchaseId: purchase!.id }
}

export async function sellItem(itemId: string, quantity: number) {
  // Note: no sales table in schema; we just decrease stock.
  if (quantity <= 0) throw new Error('Quantity must be > 0')
  const { data: item, error } = await supabase.from('inventory_items').select('stock').eq('id', itemId).single()
  if (error) throw new Error(error.message)
  const current = Number(item?.stock || 0)
  if (current < quantity) throw new Error('Insufficient stock')
  const { error: updErr } = await supabase
    .from('inventory_items')
    .update({ stock: current - quantity })
    .eq('id', itemId)
  if (updErr) throw new Error(updErr.message)
  return { success: true }
}

export async function adjustStock(itemId: string, quantity: number) {
  const { data: item, error } = await supabase.from('inventory_items').select('stock').eq('id', itemId).single()
  if (error) throw new Error(error.message)
  const current = Number(item?.stock || 0)
  const { error: updErr } = await supabase
    .from('inventory_items')
    .update({ stock: current + quantity })
    .eq('id', itemId)
  if (updErr) throw new Error(updErr.message)
  return { success: true }
}

// 4. Reports & Tracking
export async function getStockReport() {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id,name,sku,unit,price,stock,min_stock, subcategory:inventory_subcategories(id,name, category:inventory_categories(id,name))')
    .order('name')
  if (error) throw new Error(error.message)
  return (data || []).map((it: any) => ({
    id: it.id,
    name: it.name,
    sku: it.sku,
    unit: it.unit,
    price: Number(it.price || 0),
    stock: Number(it.stock || 0),
    min_stock: Number(it.min_stock || 0),
    subcategory_id: it.subcategory?.id,
    subcategory: it.subcategory?.name,
    category_id: it.subcategory?.category?.id,
    category: it.subcategory?.category?.name,
    value: Number(it.price || 0) * Number(it.stock || 0),
  }))
}

export async function getLowStockItems(minStock?: number) {
  const items = await listItems()
  return items.filter((i) => Number(i.stock) < Number(minStock ?? i.min_stock))
}

type DateRange = { from?: string; to?: string }
export async function getPurchaseHistory(params?: { itemId?: string } & DateRange) {
  let q = supabase
    .from('inventory_purchase_items')
    .select('qty,rate,amount, item:inventory_items(id,name,sku), purchase:inventory_purchases(id,purchase_date,invoice_no, party:parties(id,name))')
    .order('id', { ascending: false })
  if (params?.itemId) q = q.eq('item_id', params.itemId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  let rows = (data || []) as any[]
  if (params?.from) rows = rows.filter((r) => !params.from || String(r.purchase?.purchase_date) >= params.from!)
  if (params?.to) rows = rows.filter((r) => !params.to || String(r.purchase?.purchase_date) <= params.to!)
  return rows
}

export async function getSalesHistory(_params?: { itemId?: string } & DateRange) {
  // Not supported by current schema (no sales table)
  throw new Error('Sales history is not supported in the current schema')
}

export async function getPartyLedger(partyId: string) {
  // Uses general transactions table
  const { data, error } = await supabase
    .from('transactions')
    .select('id,date,amount,qty,direction,mode,notes,category:categories(id,name),account:accounts(id,name)')
    .eq('party_id', partyId)
    .order('date', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

// Purchases listing and details
export async function listPurchases(params?: { partyId?: string; from?: string; to?: string }) {
  let q = supabase
    .from('inventory_purchases')
    .select('id,invoice_no,purchase_date,total_amount, party:parties(id,name), items:inventory_purchase_items(id)')
    .order('purchase_date', { ascending: false })
    .order('id', { ascending: false })
  if (params?.partyId) q = q.eq('party_id', params.partyId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  let rows = (data || []) as any[]
  if (params?.from) rows = rows.filter((r) => !params.from || String(r.purchase_date) >= params.from!)
  if (params?.to) rows = rows.filter((r) => !params.to || String(r.purchase_date) <= params.to!)
  return rows.map((r) => ({ ...r, itemsCount: (r.items || []).length }))
}

export async function getPurchaseDetails(purchaseId: string) {
  const { data, error } = await supabase
    .from('inventory_purchase_items')
    .select('id,qty,rate,amount, item:inventory_items(id,name,sku,unit)')
    .eq('purchase_id', purchaseId)
  if (error) throw new Error(error.message)
  return data || []
}

export async function getPartyPurchaseHistory(partyId: string, params?: DateRange) {
  // First find purchases for the party
  const { data: purchases, error: e1 } = await supabase
    .from('inventory_purchases')
    .select('id,purchase_date,invoice_no, party:parties(id,name)')
    .eq('party_id', partyId)
    .order('purchase_date', { ascending: false })
  if (e1) throw new Error(e1.message)
  const ids = (purchases || []).map((p: any) => p.id)
  if (ids.length === 0) return []
  const { data: items, error: e2 } = await supabase
    .from('inventory_purchase_items')
    .select('id,qty,rate,amount,item:inventory_items(id,name,sku),purchase_id')
    .in('purchase_id', ids)
    .order('id', { ascending: false })
  if (e2) throw new Error(e2.message)
  const byId = Object.fromEntries((purchases || []).map((p: any) => [p.id, p]))
  let rows = (items || []).map((it: any) => ({ ...it, purchase: byId[it.purchase_id] }))
  if (params?.from) rows = rows.filter((r) => !params.from || String(r.purchase?.purchase_date) >= params.from!)
  if (params?.to) rows = rows.filter((r) => !params.to || String(r.purchase?.purchase_date) <= params.to!)
  return rows
}

// 5. Helper Functions
export async function searchItems(keyword: string) {
  const q = keyword.trim()
  let query = supabase.from('inventory_items').select('id,name,sku,price,stock')
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
  const { data, error } = await query.order('name')
  if (error) throw new Error(error.message)
  return data || []
}

export async function calculateStockValue() {
  const { data, error } = await supabase.from('inventory_items').select('price,stock')
  if (error) throw new Error(error.message)
  const total = (data || []).reduce((sum, it: any) => sum + Number(it.price || 0) * Number(it.stock || 0), 0)
  return total
}

// Latest purchase rate for an item
export async function getLatestPurchaseRate(itemId: string): Promise<number | undefined> {
  const { data, error } = await supabase
    .from('inventory_purchase_items')
    .select('rate')
    .eq('item_id', itemId)
    .order('id', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  const r = (data || [])[0]
  return r ? Number(r.rate || 0) : undefined
}

export async function generateInvoice(params: { purchaseId?: string; saleId?: string }) {
  if (params.purchaseId) {
    const { data: pur, error } = await supabase
      .from('inventory_purchases')
      .select('id,invoice_no,purchase_date,total_amount, party:parties(id,name)')
      .eq('id', params.purchaseId)
      .single()
    if (error) throw new Error(error.message)
    const { data: lines, error: e2 } = await supabase
      .from('inventory_purchase_items')
      .select('qty,rate,amount, item:inventory_items(id,name,sku,unit)')
      .eq('purchase_id', params.purchaseId)
    if (e2) throw new Error(e2.message)
    return { header: pur, lines: lines || [] }
  }
  if (params.saleId) {
    throw new Error('Sales invoices are not supported in the current schema')
  }
  throw new Error('Provide purchaseId or saleId')
}

export function exportReport(filename: string, rows: Record<string, any>[], format: 'CSV' | 'PDF' = 'CSV') {
  if (format === 'CSV') {
    const headers = Object.keys(rows[0] || {})
    const csv = toCsv(rows, headers)
    download(filename.endsWith('.csv') ? filename : `${filename}.csv`, csv)
    return { success: true }
  }
  throw new Error('PDF export not implemented')
}
