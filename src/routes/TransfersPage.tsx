import TransferForm from '../features/transfers/TransferForm'

export default function TransfersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Transfers</h1>
        <p className="text-sm text-muted-foreground">Move money between your accounts.</p>
      </div>
      <TransferForm />
    </div>
  )
}

