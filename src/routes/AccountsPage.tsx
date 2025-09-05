import { useAccounts } from '../hooks/useAccounts'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { IconAccounts } from '../components/icons'
import { formatCurrency } from '../lib/format'
import AddAccountForm from '../features/accounts/AddAccountForm'

export default function AccountsPage() {
  const { data, refetch, error } = useAccounts()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-2">Accounts</h1>
        <AddAccountForm onCreated={refetch} />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconAccounts size={18} className="text-primary" />
                {a.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Kind: {a.kind}</p>
              <p className="mt-2 font-medium">Opening: {formatCurrency(a.opening_balance)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
