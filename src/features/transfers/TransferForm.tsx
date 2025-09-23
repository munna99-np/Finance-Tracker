import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { transferSchema } from '../../types/transactions'
import { useAccounts } from '../../hooks/useAccounts'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import MoneyInput from '../../components/fields/MoneyInput'
import { supabase } from '../../lib/supabaseClient'
import { toast } from 'sonner'

const formSchema = transferSchema.extend({
  date: z.coerce.date(),
})

type FormValues = z.infer<typeof formSchema>

export default function TransferForm({ onCreated }: { onCreated?: () => void }) {
  const { data: accounts } = useAccounts()
  const navigate = useNavigate()
  const location = useLocation() as any
  const prefill = (location?.state || {}) as Partial<FormValues>

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      // Use ISO string for input[type=date]; Zod coerces on submit
      date: (prefill.date as any) || new Date().toISOString().slice(0, 10),
      amount: prefill.amount ?? undefined,
      from_account: prefill.from_account ?? undefined,
      to_account: prefill.to_account ?? undefined,
    } as any,
  })

  useEffect(() => {
    // clear the state after using it so back/forward doesn't reapply
    if (location?.state) {
      navigate('.', { replace: true })
    }
  }, [location?.state, navigate])

  const onSubmit = async (values: FormValues) => {
    if (!values.from_account || !values.to_account) return toast.error('Select both accounts')
    if (values.from_account === values.to_account) return toast.error('Accounts must be different')
    if (!values.amount || values.amount <= 0) return toast.error('Amount must be positive')
    const payload = {
      ...values,
      date: values.date.toISOString().slice(0, 10),
    }
    const { error } = await supabase.from('transfers').insert(payload as any)
    if (error) return toast.error(error.message)
    toast.success('Transfer added')
    form.reset({ date: new Date().toISOString().slice(0, 10) } as any)
    onCreated?.()
  }

  return (
    <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={form.handleSubmit(onSubmit)}>
      <div>
        <label className="text-sm">Date</label>
        <Input type="date" {...form.register('date')} />
      </div>
      <div>
        <label className="text-sm">From account</label>
        <select className="h-9 w-full border rounded-md px-2" {...form.register('from_account')}> 
          <option value="">Select account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id} disabled={a.id === form.watch('to_account')}>{a.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm">To account</label>
        <select className="h-9 w-full border rounded-md px-2" {...form.register('to_account')}> 
          <option value="">Select account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id} disabled={a.id === form.watch('from_account')}>{a.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm">Amount</label>
        <MoneyInput value={form.watch('amount') as any} onChange={(v) => form.setValue('amount', v as any, { shouldValidate: true })} />
      </div>
      <div className="md:col-span-2">
        <label className="text-sm">Notes</label>
        <Input placeholder="Optional" {...form.register('notes')} />
      </div>
      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button type="submit">Add Transfer</Button>
      </div>
    </form>
  )
}
