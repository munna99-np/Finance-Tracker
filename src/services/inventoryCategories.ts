import { supabase } from '../lib/supabaseClient'

export type InvCategory = { id: string; name: string }
export type InvCategoryWithCounts = InvCategory & { subCount: number }
export type InvSubcategory = { id: string; category_id: string; name: string }
export type InvSubcategoryWithCounts = InvSubcategory & { itemCount: number }

// Categories
export async function addCategory(name: string): Promise<InvCategory> {
  const n = name.trim()
  if (!n) throw new Error('Name is required')
  const { data, error } = await supabase
    .from('inventory_categories')
    .insert({ name: n })
    .select('id,name')
    .single()
  if (error) throw new Error(error.message)
  return data as InvCategory
}

export async function updateCategory(id: string, newName: string): Promise<void> {
  const n = newName.trim()
  if (!n) throw new Error('Name is required')
  const { error } = await supabase
    .from('inventory_categories')
    .update({ name: n })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_categories')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listCategories(): Promise<InvCategoryWithCounts[]> {
  const { data, error } = await supabase
    .from('inventory_categories')
    .select('id,name, inventory_subcategories:inventory_subcategories(id)')
    .order('name')
  if (error) throw new Error(error.message)
  const rows = (data || []).map((c: any) => ({ id: c.id, name: c.name, subCount: c.inventory_subcategories?.length || 0 }))
  return rows as InvCategoryWithCounts[]
}

// Subcategories
export async function addSubcategory(categoryId: string, name: string): Promise<InvSubcategory> {
  const n = name.trim()
  if (!n) throw new Error('Name is required')
  const { data, error } = await supabase
    .from('inventory_subcategories')
    .insert({ name: n, category_id: categoryId })
    .select('id,category_id,name')
    .single()
  if (error) throw new Error(error.message)
  return data as InvSubcategory
}

export async function updateSubcategory(id: string, newName: string): Promise<void> {
  const n = newName.trim()
  if (!n) throw new Error('Name is required')
  const { error } = await supabase
    .from('inventory_subcategories')
    .update({ name: n })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteSubcategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_subcategories')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listSubcategories(categoryId?: string): Promise<InvSubcategoryWithCounts[]> {
  let q = supabase
    .from('inventory_subcategories')
    .select('id,category_id,name, inventory_items:inventory_items(id)')
    .order('name')
  if (categoryId) q = q.eq('category_id', categoryId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const rows = (data || []).map((s: any) => ({ id: s.id, category_id: s.category_id, name: s.name, itemCount: s.inventory_items?.length || 0 }))
  return rows as InvSubcategoryWithCounts[]
}

