import { NavLink } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Button } from '../../components/ui/button'
import RecordSaleDialog from './RecordSaleDialog'
import BillingHistoryDialog from './BillingHistoryDialog'
import CustomerLedgerDialog from './CustomerLedgerDialog'
import { ShoppingCart, Boxes, PackageSearch, Layers, ShoppingBag, BarChart3, ReceiptText, UserRound } from 'lucide-react'

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
  const [saleOpen, setSaleOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [ledgerOpen, setLedgerOpen] = useState(false)

  const tabs = useMemo(
    () => [
      { to: '/inventory/stock', label: 'Stock', icon: Boxes },
      { to: '/inventory/items', label: 'Items', icon: PackageSearch },
      { to: '/inventory/categories', label: 'Categories', icon: Layers },
      { to: '/inventory/purchases', label: 'Purchases', icon: ShoppingBag },
      { to: '/inventory/reports', label: 'Reports', icon: BarChart3 },
    ],
    []
  )

  const fetchTotalStock = useCallback(async () => {
    const { data, error } = await supabase.from('inventory_items').select('stock')
    if (error) throw new Error(error.message)
    const total = (data || []).reduce((sum: number, row: any) => sum + Number(row.stock || 0), 0)
    return Number(total.toFixed(2))
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const total = await fetchTotalStock()
        if (!active) return
        setTotalStock(total)
      } catch {
        if (!active) return
        setTotalStock(null)
      }
    })()
    return () => {
      active = false
    }
  }, [fetchTotalStock])

  const handleSaleComplete = useCallback(async () => {
    try {
      const total = await fetchTotalStock()
      setTotalStock(total)
    } catch {
      setTotalStock(null)
    } finally {
      setSaleOpen(false)
    }
  }, [fetchTotalStock])

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 border rounded-md p-1 bg-muted/40">
          {tabs.map((tab) => (
            <TabLink
              key={tab.to}
              to={tab.to}
              label={
                <span className="flex items-center gap-2">
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {tab.to === '/inventory/stock' && totalStock !== null && (
                    <span className="text-xs text-muted-foreground">{totalStock}</span>
                  )}
                </span>
              }
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
            onClick={() => setSaleOpen(true)}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Record sale
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
            onClick={() => setLedgerOpen(true)}
          >
            <UserRound className="mr-2 h-4 w-4" />
            Customers
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
            onClick={() => setHistoryOpen(true)}
          >
            <ReceiptText className="mr-2 h-4 w-4" />
            Invoice history
          </Button>
        </div>
      </div>
      <RecordSaleDialog open={saleOpen} onOpenChange={setSaleOpen} onSaleComplete={handleSaleComplete} />
      <BillingHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
      <CustomerLedgerDialog open={ledgerOpen} onOpenChange={setLedgerOpen} />
    </>
  )
}
