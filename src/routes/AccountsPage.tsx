import { useState } from 'react'
import { useAccounts } from '../hooks/useAccounts'
import AddAccountForm from '../features/accounts/AddAccountForm'
import BankCard from '../features/accounts/BankCard'
import AccountDetailsDialog from '../features/accounts/AccountDetailsDialog'
import type { Account } from '../types/accounts'

export default function AccountsPage() {
  const { data, refetch, error } = useAccounts()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<Account | null>(null)

  function openAccount(a: Account) {
    setCurrent(a)
    setOpen(true)
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-2">Accounts</h1>
        <AddAccountForm onCreated={refetch} />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((a) => (
          <BankCard key={a.id} account={a} onOpen={openAccount} />
        ))}
      </div>

      <AccountDetailsDialog account={current} open={open} onOpenChange={setOpen} />
    </div>
  )
}
