import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useInvCategories() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refetch = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('inventory_categories')
      .select('id,name,created_at, inventory_subcategories:inventory_subcategories(id)')
      .order('name')
    if (error) setError(error.message)
    const rows = (data || []).map((c: any) => ({ id: c.id, name: c.name, subCount: c.inventory_subcategories?.length || 0 }))
    setData(rows)
    setLoading(false)
  }
  useEffect(() => { refetch() }, [])
  return { data, loading, error, refetch }
}

export function useInvSubcategories(categoryId?: string) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refetch = async () => {
    setLoading(true)
    let q = supabase.from('inventory_subcategories').select('id,category_id,name,created_at, inventory_items:inventory_items(id)')
    if (categoryId) q = q.eq('category_id', categoryId)
    q = q.order('name')
    const { data, error } = await q
    if (error) setError(error.message)
    const rows = (data || []).map((s: any) => ({ id: s.id, category_id: s.category_id, name: s.name, itemCount: s.inventory_items?.length || 0 }))
    setData(rows)
    setLoading(false)
  }
  useEffect(() => { refetch() }, [categoryId])
  return { data, loading, error, refetch }
}

export type ItemFilters = { subcategoryId?: string; search?: string; page?: number }
export function useInvItems(filters: ItemFilters = {}) {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const limit = 20
  const deps = useMemo(() => JSON.stringify(filters), [filters])
  const refetch = async () => {
    setLoading(true)
    let q = supabase.from('inventory_items').select('*', { count: 'exact' })
    if (filters.subcategoryId) q = q.eq('subcategory_id', filters.subcategoryId)
    if (filters.search) {
      const s = `%${filters.search}%`
      q = q.or(`name.ilike.${s},sku.ilike.${s}`)
    }
    const page = filters.page || 1
    const from = (page - 1) * limit
    const to = from + limit - 1
    q = q.order('created_at', { ascending: false }).range(from, to)
    const { data, error, count } = await q
    if (error) setError(error.message)
    setData(data || [])
    setTotal(count || 0)
    setLoading(false)
  }
  useEffect(() => { refetch() }, [deps])
  return { data, total, loading, error, refetch, limit }
}

export function useInvItemDetails(itemId?: string) {
  const [item, setItem] = useState<any | null>(null)
  const [purchases, setPurchases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!itemId) return
    let active = true
    ;(async () => {
      setLoading(true)
      const { data: itemRows, error: e1 } = await supabase
        .from('inventory_items')
        .select('id,name,sku,unit,price,stock,min_stock,notes, subcategory:inventory_subcategories(id,name, category:inventory_categories(id,name))')
        .eq('id', itemId)
        .single()
      if (!active) return
      if (e1) { setError(e1.message); setLoading(false); return }
      setItem(itemRows)
      const { data: lines, error: e2 } = await supabase
        .from('inventory_purchase_items')
        .select('qty,rate,amount, purchase:inventory_purchases(purchase_date, invoice_no, party:parties(name))')
        .eq('item_id', itemId)
        .order('id', { ascending: false })
        .limit(5)
      if (e2) setError(e2.message)
      setPurchases(lines || [])
      setLoading(false)
    })()
    return () => { active = false }
  }, [itemId])
  return { item, purchases, loading, error }
}

export function usePartySearch(query: string) {
  const [data, setData] = useState<any[]>([])
  useEffect(() => {
    let active = true
    ;(async () => {
      let q = supabase.from('parties').select('id,name,phone').order('name')
      if (query.trim()) q = q.ilike('name', `%${query}%`)
      const { data } = await q.limit(10)
      if (!active) return
      setData(data || [])
    })()
    return () => { active = false }
  }, [query])
  return { data }
}

