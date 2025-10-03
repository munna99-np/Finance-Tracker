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

export type SaleLineInput = {
  itemId: string
  quantity: number
  price?: number
}

export type SalePaymentMethod = 'cash' | 'online' | 'cheque' | 'credit'

export type BillingStatus = 'paid' | 'pending' | 'failed'

export type SaleLineResult = {
  itemId: string
  quantity: number
  price: number
  amount: number
  remaining: number
}

export type SaleMetadata = {
  partyId?: string | null
  partyName?: string | null
  paymentMethod?: SalePaymentMethod
  billingStatus?: BillingStatus
  invoiceNo?: string | null
  invoiceDate?: string | null
  notes?: string | null
  addToBillingHistory?: boolean
}
export type SaleRecord = {
  lines: SaleLineResult[]
  totalAmount: number
  partyId?: string | null
  partyName?: string
  billingStatus?: BillingStatus
  paymentMethod?: SalePaymentMethod
}

export type BillingHistoryLineInput = {
  itemId: string
  name: string
  sku?: string | null
  unit?: string | null
  quantity: number
  price: number
  amount?: number
}

export type BillingHistoryLine = {
  itemId: string
  name: string
  sku: string | null
  unit: string | null
  quantity: number
  price: number
  amount: number
}

export type BillingHistoryInput = {
  invoiceNo: string
  invoiceDate: string
  partyName?: string | null
  paymentMethod: SalePaymentMethod
  status?: BillingStatus
  totalAmount?: number
  items: BillingHistoryLineInput[]
  notes?: string | null
}

export type BillingHistoryEntry = {
  id: string
  invoiceNo: string
  invoiceDate: string
  partyName?: string | null
  paymentMethod: SalePaymentMethod
  status: BillingStatus
  totalAmount: number
  items: BillingHistoryLine[]
  notes?: string | null
  createdAt: string
}

export type BillingHistoryListResult = {
  rows: BillingHistoryEntry[]
  total: number
}

export type PartyLedgerEntryType = 'sale' | 'purchase' | 'payment' | 'adjustment'
export type PartyLedgerDirection = 'in' | 'out'

export type PartyLedgerEntry = {
  id: string
  partyId: string
  entryDate: string
  entryType: PartyLedgerEntryType
  direction: PartyLedgerDirection
  amount: number
  paymentMethod?: string | null
  notes?: string | null
  referenceTable?: string | null
  referenceId?: string | null
  metadata?: Record<string, any> | null
  createdAt: string
}

export type PartyLedgerSummary = {
  partyId: string
  partyName: string
  phone?: string | null
  lastActivity: string | null
  balance: number
  totalSold: number
  totalPurchased: number
  paymentsReceived: number
  paymentsIssued: number
  entryCount: number
}

export type CustomerLedgerFeedEntry = PartyLedgerEntry & {
  partyName: string
  partyPhone?: string | null
}

export type CustomerLedgerQuery = {
  search?: string
  paymentMethods?: string[]
  entryTypes?: PartyLedgerEntryType[]
  page?: number
  limit?: number
}

export type LedgerPaymentInput = {
  partyId: string
  amount: number
  direction: PartyLedgerDirection
  paymentMethod?: string | null
  entryDate?: string
  notes?: string | null
  metadata?: Record<string, any> | null
}

const PAYMENT_STATUS_FOR_METHOD: Record<SalePaymentMethod, BillingStatus> = {
  cash: 'paid',
  online: 'paid',
  cheque: 'pending',
  credit: 'pending',
}
type LedgerEntryInsert = {
  partyId: string
  entryType: PartyLedgerEntryType
  direction: PartyLedgerDirection
  amount: number
  paymentMethod?: string | null
  entryDate?: string
  notes?: string | null
  referenceTable?: string | null
  referenceId?: string | null
  metadata?: Record<string, any> | null
}

function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(2))
}

function ensureDateOnly(value?: string | null): string {
  if (value && value.trim()) {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

type ResolvedParty = { partyId: string; partyName: string }

async function resolveParty(partyId?: string | null, partyName?: string | null): Promise<ResolvedParty | null> {
  const trimmedName = partyName?.trim()
  if (partyId) {
    if (trimmedName) return { partyId, partyName: trimmedName }
    const { data, error } = await supabase
      .from('parties')
      .select('name')
      .eq('id', partyId)
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const name = (data?.name ?? '').trim()
    return { partyId, partyName: name || trimmedName || 'Walk-in customer' }
  }
  if (!trimmedName) return null
  const { data: existing, error } = await supabase
    .from('parties')
    .select('id')
    .eq('name', trimmedName)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (existing?.id) return { partyId: existing.id, partyName: trimmedName }
  const { data: created, error: insertError } = await supabase
    .from('parties')
    .insert({ name: trimmedName })
    .select('id')
    .single()
  if (insertError) throw new Error(insertError.message)
  if (!created?.id) throw new Error('Failed to create party record')
  return { partyId: created.id, partyName: trimmedName }
}

function mapLedgerRow(row: any): PartyLedgerEntry {
  const rawMetadata = row?.metadata
  let metadata: Record<string, any> | null = null
  if (rawMetadata && typeof rawMetadata === 'object') metadata = rawMetadata
  else if (typeof rawMetadata === 'string') {
    try {
      metadata = JSON.parse(rawMetadata)
    } catch {
      metadata = { raw: rawMetadata }
    }
  }
  const entryDateSource = row?.entry_date ?? row?.created_at ?? new Date().toISOString()
  return {
    id: String(row.id),
    partyId: String(row.party_id),
    entryDate: ensureDateOnly(entryDateSource),
    entryType: row.entry_type as PartyLedgerEntryType,
    direction: row.direction as PartyLedgerDirection,
    amount: roundCurrency(Number(row.amount ?? 0)),
    paymentMethod: row.payment_method ?? null,
    notes: row.notes ?? null,
    referenceTable: row.reference_table ?? null,
    referenceId: row.reference_id ?? null,
    metadata,
    createdAt: String(row.created_at ?? entryDateSource),
  }
}

function computePartyLedgerSummary(
  party: { id: string; name: string; phone?: string | null },
  entries: PartyLedgerEntry[]
): PartyLedgerSummary {
  let totalSold = 0
  let totalPurchased = 0
  let paymentsReceived = 0
  let paymentsIssued = 0
  let lastActivity: string | null = null
  let runningBalance = 0

  for (const entry of entries) {
    const amount = roundCurrency(entry.amount)
    const directionSign = entry.direction === 'out' ? -1 : 1

    if (entry.entryType === 'sale') {
      totalSold += directionSign * amount
    } else if (entry.entryType === 'purchase') {
      totalPurchased += directionSign * amount
    } else if (entry.entryType === 'payment') {
      if (entry.direction === 'out') paymentsReceived += amount
      else paymentsIssued += amount
    } else if (entry.entryType === 'adjustment') {
      if (entry.direction === 'in') totalSold += amount
      else totalPurchased += amount
    }

    runningBalance += directionSign * amount

    const activityDate = entry.createdAt || entry.entryDate
    if (!lastActivity || activityDate > lastActivity) lastActivity = activityDate
  }

  return {
    partyId: party.id,
    partyName: party.name,
    phone: party.phone ?? null,
    lastActivity,
    balance: roundCurrency(runningBalance),
    totalSold: roundCurrency(totalSold),
    totalPurchased: roundCurrency(totalPurchased),
    paymentsReceived: roundCurrency(paymentsReceived),
    paymentsIssued: roundCurrency(paymentsIssued),
    entryCount: entries.length,
  }
}

async function insertLedgerEntry(input: LedgerEntryInsert): Promise<PartyLedgerEntry> {
  if (!input.partyId) throw new Error('Party is required for ledger entry')
  const amount = roundCurrency(Number(input.amount ?? 0))
  if (amount <= 0) throw new Error('Ledger amount must be greater than zero')

  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  if (sessionError) throw new Error(sessionError.message)
  const ownerId = sessionData.user?.id
  if (!ownerId) throw new Error('Sign in required to record ledger entries')

  const payload = {
    party_id: input.partyId,
    entry_type: input.entryType,
    direction: input.direction,
    amount,
    payment_method: input.paymentMethod ?? null,
    entry_date: ensureDateOnly(input.entryDate),
    notes: input.notes ?? null,
    reference_table: input.referenceTable ?? null,
    reference_id: input.referenceId ?? null,
    metadata: input.metadata ?? null,
    owner: ownerId,
  }

  const { data, error } = await supabase
    .from('inventory_party_ledger')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapLedgerRow(data)
}

export async function listPartyLedgerEntries(partyId: string): Promise<PartyLedgerEntry[]> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  if (sessionError) throw new Error(sessionError.message)
  const ownerId = sessionData.user?.id
  if (!ownerId) throw new Error('Sign in required to view customer ledger')

  const { data, error } = await supabase
    .from('inventory_party_ledger')
    .select('*')
    .eq('owner', ownerId)
    .eq('party_id', partyId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapLedgerRow)
}

export async function listPartyLedgerSummaries(): Promise<PartyLedgerSummary[]> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  if (sessionError) throw new Error(sessionError.message)
  const ownerId = sessionData.user?.id
  if (!ownerId) throw new Error('Sign in required to view customer ledgers')

  const [partiesResult, ledgerResult] = await Promise.all([
    supabase.from('parties').select('id,name,phone').eq('owner', ownerId).order('name'),
    supabase
      .from('inventory_party_ledger')
      .select('*')
      .eq('owner', ownerId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])
  if (partiesResult.error) throw new Error(partiesResult.error.message)
  if (ledgerResult.error) throw new Error(ledgerResult.error.message)

  const entriesByParty = new Map<string, PartyLedgerEntry[]>()
  for (const row of ledgerResult.data ?? []) {
    const mapped = mapLedgerRow(row)
    const bucket = entriesByParty.get(mapped.partyId)
    if (bucket) bucket.push(mapped)
    else entriesByParty.set(mapped.partyId, [mapped])
  }

  const summaries = (partiesResult.data ?? []).map((party) => {
    const entries = entriesByParty.get(party.id) ?? []
    entries.sort((a, b) => (a.entryDate < b.entryDate ? 1 : a.entryDate > b.entryDate ? -1 : 0))
    return computePartyLedgerSummary(party, entries)
  })
  return summaries
}

export async function listAllCustomerLedgerEntries(params: CustomerLedgerQuery = {}): Promise<{ rows: CustomerLedgerFeedEntry[]; total: number }> {
  const limit = params.limit && params.limit > 0 ? params.limit : 50
  const page = params.page && params.page > 0 ? params.page : 1
  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  if (sessionError) throw new Error(sessionError.message)
  const ownerId = sessionData.user?.id
  if (!ownerId) throw new Error('Sign in required to view customer ledgers')

  let query = supabase
    .from('inventory_party_ledger')
    .select('*, party:parties(id,name,phone)', { count: 'exact' })
    .eq('owner', ownerId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.paymentMethods && params.paymentMethods.length > 0) {
    query = query.in('payment_method', params.paymentMethods)
  }
  if (params.entryTypes && params.entryTypes.length > 0) {
    query = query.in('entry_type', params.entryTypes)
  }
  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim().replace(/%/g, '\%')}%`
    const filters = [
      `notes.ilike.${term}`,
      `metadata->>invoiceNo.ilike.${term}`,
      `party.name.ilike.${term}`
    ].map((clause) => clause.replace(/,/g, '\,'))
    query = query.or(filters.join(','))
  }

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const rows = (data || []).map((row: any) => {
    const entry = mapLedgerRow(row)
    const partyName = String(row?.party?.name ?? 'Walk-in customer')
    const partyPhone = row?.party?.phone ?? null
    return {
      ...entry,
      partyName,
      partyPhone,
    } as CustomerLedgerFeedEntry
  })

  return { rows, total: count ?? rows.length }
}

export async function getPartyLedgerSummary(partyId: string): Promise<PartyLedgerSummary> {
  const [{ data: party, error: partyError }, entries] = await Promise.all([
    supabase.from('parties').select('id,name,phone').eq('id', partyId).single(),
    listPartyLedgerEntries(partyId),
  ])
  if (partyError) throw new Error(partyError.message)
  if (!party) throw new Error('Customer not found')
  return computePartyLedgerSummary(party, entries)
}

export async function recordLedgerPayment(input: LedgerPaymentInput): Promise<PartyLedgerEntry> {
  const resolved = await resolveParty(input.partyId, undefined)
  if (!resolved) throw new Error('Party is required for payment entry')
  return insertLedgerEntry({
    partyId: resolved.partyId,
    entryType: 'payment',
    direction: input.direction,
    amount: input.amount,
    paymentMethod: input.paymentMethod ?? null,
    entryDate: input.entryDate,
    notes: input.notes ?? null,
    metadata: input.metadata ?? null,
  })
}

export async function recordPurchaseLedger(input: { partyId: string; amount: number; paymentMethod?: string | null; entryDate?: string; notes?: string | null; metadata?: Record<string, any> | null }): Promise<PartyLedgerEntry> {
  const resolved = await resolveParty(input.partyId, undefined)
  if (!resolved) throw new Error('Party is required for purchase entry')
  return insertLedgerEntry({
    partyId: resolved.partyId,
    entryType: 'purchase',
    direction: 'out',
    amount: input.amount,
    paymentMethod: input.paymentMethod ?? null,
    entryDate: input.entryDate,
    notes: input.notes ?? null,
    metadata: input.metadata ?? null,
  })
}

export async function recordSale(lines: SaleLineInput[], metadata: SaleMetadata = {}): Promise<SaleRecord> {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error('No sale items provided')
  const prepared = lines.map((line) => ({
    itemId: String(line.itemId),
    quantity: Number(line.quantity),
    price: line.price,
  }))
  const seen = new Set<string>()
  prepared.forEach((line) => {
    if (!line.itemId) throw new Error('Item is required for sale')
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error('Quantity must be greater than zero')
    if (seen.has(line.itemId)) throw new Error('Each item can only appear once per sale')
    seen.add(line.itemId)
  })

  const results: SaleLineResult[] = []
  const adjustments: { itemId: string; previousStock: number; previousPrice: number }[] = []
  for (const line of prepared) {
    const { data: item, error } = await supabase
      .from('inventory_items')
      .select('stock,price')
      .eq('id', line.itemId)
      .single()
    if (error) throw new Error(error.message)
    const currentStock = Number(item?.stock ?? 0)
    const previousPrice = Number(item?.price ?? 0)
    if (line.quantity > currentStock) throw new Error('Insufficient stock for one of the selected items')
    const candidatePrice =
      typeof line.price === 'number' && Number.isFinite(line.price) ? Number(line.price) : Number(item?.price ?? 0)
    const cleanPrice = Number.isFinite(candidatePrice) ? Number(candidatePrice.toFixed(2)) : 0
    const remaining = Number((currentStock - line.quantity).toFixed(4))
    const updatePayload: Record<string, number> = { stock: remaining }
    if (cleanPrice >= 0) updatePayload.price = cleanPrice
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update(updatePayload)
      .eq('id', line.itemId)
    if (updateError) throw new Error(updateError.message)
    adjustments.push({ itemId: line.itemId, previousStock: currentStock, previousPrice })
    const amount = Number((cleanPrice * line.quantity).toFixed(2))
    results.push({ itemId: line.itemId, quantity: line.quantity, price: cleanPrice, amount, remaining })
  }

  const totalAmount = roundCurrency(results.reduce((sum, row) => sum + row.amount, 0))
  const paymentMethod = metadata.paymentMethod ?? 'cash'
  const billingStatus = metadata.billingStatus ?? inferBillingStatus(paymentMethod)

  let resolvedParty: ResolvedParty | null = null
  if (metadata.partyId || metadata.partyName) {
    resolvedParty = await resolveParty(metadata.partyId ?? undefined, metadata.partyName ?? undefined)
  }

  if (resolvedParty && totalAmount > 0) {
    const ledgerMetadata: Record<string, any> = {}
    if (metadata.invoiceNo) ledgerMetadata.invoiceNo = metadata.invoiceNo
    if (billingStatus) ledgerMetadata.billingStatus = billingStatus
    try {
      await insertLedgerEntry({
        partyId: resolvedParty.partyId,
        entryType: 'sale',
        direction: 'in',
        amount: totalAmount,
        paymentMethod,
        entryDate: metadata.invoiceDate ?? undefined,
        notes: metadata.notes ?? null,
        metadata: Object.keys(ledgerMetadata).length ? ledgerMetadata : null,
      })
    } catch (error) {
      for (const adjustment of adjustments) {
        const revertPayload: Record<string, number> = { stock: adjustment.previousStock }
        if (Number.isFinite(adjustment.previousPrice)) {
          revertPayload.price = adjustment.previousPrice
        }
        try {
          await supabase
            .from('inventory_items')
            .update(revertPayload)
            .eq('id', adjustment.itemId)
        } catch (revertError) {
          console.error('Failed to revert inventory stock after ledger error', revertError)
        }
      }
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  const effectivePartyId = resolvedParty?.partyId ?? metadata.partyId ?? null
  const metadataPartyName = metadata.partyName?.trim()
  const effectivePartyName = resolvedParty?.partyName ?? (metadataPartyName ? metadataPartyName : undefined)

  return {
    lines: results,
    totalAmount,
    partyId: effectivePartyId,
    partyName: effectivePartyName,
    billingStatus,
    paymentMethod,
  }
}

export async function sellItem(itemId: string, quantity: number, price?: number, metadata?: SaleMetadata) {
  const result = await recordSale([{ itemId, quantity, price }], metadata)
  const line = result.lines[0]
  return {
    success: true,
    ...line,
    totalAmount: result.totalAmount,
    partyId: result.partyId ?? null,
    partyName: result.partyName,
    billingStatus: result.billingStatus,
    paymentMethod: result.paymentMethod,
  }
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
export async function searchItems(keyword: string, options: { inStockOnly?: boolean; limit?: number } = {}) {
  const q = keyword.trim()
  let query = supabase.from('inventory_items').select('id,name,sku,price,stock,unit')
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
  if (options.inStockOnly) query = query.gt('stock', 0)
  query = query.order('name')
  const limit = options.limit ?? 50
  if (limit > 0) query = query.limit(limit)
  const { data, error } = await query
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

function normalizeBillingLines(lines: BillingHistoryLineInput[]): BillingHistoryLine[] {
  return lines
    .map((line) => {
      const quantity = Number(line.quantity)
      const price = Number(line.price)
      const amount = line.amount !== undefined ? Number(line.amount) : Number(quantity * price)
      return {
        itemId: String(line.itemId),
        name: line.name,
        sku: line.sku ?? null,
        unit: line.unit ?? null,
        quantity: Number.isFinite(quantity) ? Number(quantity.toFixed(3)) : 0,
        price: Number.isFinite(price) ? Number(price.toFixed(2)) : 0,
        amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0,
      }
    })
    .filter((line) => line.itemId && line.name)
}

function mapInvoiceRow(row: any): BillingHistoryEntry {
  const rawItems = Array.isArray(row?.items) ? row.items : []
  const items: BillingHistoryLine[] = rawItems.map((item: any) => ({
    itemId: String(item.itemId ?? item.item_id ?? ''),
    name: String(item.name ?? ''),
    sku: item.sku ?? null,
    unit: item.unit ?? null,
    quantity: Number(item.quantity ?? item.qty ?? 0),
    price: Number(item.price ?? 0),
    amount: Number(item.amount ?? Number(item.quantity ?? item.qty ?? 0) * Number(item.price ?? 0)),
  }))
  const total = Number(row?.total_amount ?? items.reduce((sum, line) => sum + Number(line.amount || 0), 0))
  return {
    id: String(row.id),
    invoiceNo: String(row.invoice_no),
    invoiceDate: String(row.invoice_date),
    partyName: row.party_name ?? null,
    paymentMethod: (row.payment_method ?? 'cash') as SalePaymentMethod,
    status: (row.status ?? PAYMENT_STATUS_FOR_METHOD[(row.payment_method ?? 'cash') as SalePaymentMethod]) as BillingStatus,
    totalAmount: Number(total.toFixed(2)),
    items,
    notes: row.notes ?? null,
    createdAt: String(row.created_at ?? row.invoice_date),
  }
}

export function inferBillingStatus(paymentMethod: SalePaymentMethod, explicit?: BillingStatus): BillingStatus {
  if (explicit) return explicit
  return PAYMENT_STATUS_FOR_METHOD[paymentMethod] ?? 'pending'
}

export async function addBillingHistoryEntry(input: BillingHistoryInput): Promise<BillingHistoryEntry> {
  const invoiceNo = input.invoiceNo?.trim()
  if (!invoiceNo) throw new Error('Invoice number is required')
  if (!input.paymentMethod) throw new Error('Payment method is required')
  const items = normalizeBillingLines(input.items)
  if (items.length === 0) throw new Error('Add at least one item to save billing history')
  const baseTotal = items.reduce((sum, line) => sum + Number(line.amount || 0), 0)
  const totalAmount = input.totalAmount !== undefined ? Number(input.totalAmount) : baseTotal
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  if (sessionError) throw new Error(sessionError.message)
  const ownerId = sessionData.user?.id
  if (!ownerId) throw new Error('Sign in required to save billing history')
  const payload = {
    invoice_no: invoiceNo,
    invoice_date: input.invoiceDate || new Date().toISOString(),
    party_name: input.partyName?.trim() || null,
    payment_method: input.paymentMethod,
    status: inferBillingStatus(input.paymentMethod, input.status),
    total_amount: Number.isFinite(totalAmount) ? Number(totalAmount.toFixed(2)) : baseTotal,
    items,
    owner: ownerId,
    notes: input.notes ?? null,
  }
  const { data, error } = await supabase
    .from('inventory_sale_invoices')
    .upsert(payload, { onConflict: 'owner,invoice_no' })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapInvoiceRow(data)
}

export async function listBillingHistory(params: { search?: string; page?: number; limit?: number } = {}): Promise<BillingHistoryListResult> {
  const limit = params.limit ?? 20
  const page = params.page ?? 1
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  if (sessionError) throw new Error(sessionError.message)
  const ownerId = sessionData.user?.id
  if (!ownerId) throw new Error('Sign in required to view billing history')
  let query = supabase
    .from('inventory_sale_invoices')
    .select('*', { count: 'exact' })
    .eq('owner', ownerId)
    .order('invoice_date', { ascending: false })
    .order('created_at', { ascending: false })
  const search = params.search?.trim()
  if (search) {
    const term = `%${search}%`
    query = query.or(`invoice_no.ilike.${term},party_name.ilike.${term}`)
  }
  if (limit > 0) {
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)
  }
  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  const rows = (data || []).map(mapInvoiceRow)
  return { rows, total: count ?? rows.length }
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
























