import InventoryNav from '../features/inventory/InventoryNav'
import StockTable from '../features/inventory/StockTable'

export default function InventoryStockPage() {
  return (
    <div className="space-y-4">
      <InventoryNav />
      <StockTable />
    </div>
  )
}

