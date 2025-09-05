import InventoryNav from '../features/inventory/InventoryNav'
import CategoryTree from '../features/inventory/CategoryTree'

export default function InventoryCategoriesPage() {
  return (
    <div className="space-y-4">
      <InventoryNav />
      <div className="border rounded-md p-3 max-w-2xl">
        <CategoryTree onSelect={() => { /* no-op: standalone manager */ }} />
      </div>
    </div>
  )
}
