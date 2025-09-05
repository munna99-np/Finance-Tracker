import { NavLink } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabaseClient'

function TabLink({ to, label }: { to: string; label: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 h-9 inline-flex items-center rounded-md text-sm transition-colors ${
          isActive ? 'bg-white shadow-sm border' : 'hover:bg-white/60'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function InventoryNav() {
  const [totalStock, setTotalStock] = useState<number | null>(null)
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await supabase.from('inventory_items').select('stock')
      if (!active) return
      if (error) { setTotalStock(null); return }
      const total = (data || []).reduce((s: number, r: any) => s + Number(r.stock || 0), 0)
      setTotalStock(Number(total.toFixed(2)))
    })()
    return () => { active = false }
  }, [])
  return (
    <div className="inline-flex items-center gap-1 border rounded-md p-1 bg-muted/40">
      <TabLink to="/inventory/stock" label={<>
        Stock{totalStock !== null && <span className="ml-2 text-xs text-muted-foreground">• {totalStock}</span>}
      </>} />
      <TabLink to="/inventory/items" label="Items" />
      <TabLink to="/inventory/categories" label="Categories" />
      <TabLink to="/inventory/purchases" label="Purchases" />
      <TabLink to="/inventory/reports" label="Reports" />
    </div>
  )
}
