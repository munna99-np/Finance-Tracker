import InventoryNav from '../features/inventory/InventoryNav'

export default function InventoryPage() {
  return (
    <div className="space-y-4">
      <InventoryNav />
      <div className="text-sm text-muted-foreground">
        Choose a section above. Items table and actions show on the Items page; category management on Categories; purchase entry on Purchases.
      </div>
    </div>
  )
}
