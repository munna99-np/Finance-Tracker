import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { transactionSchema } from '../../types/transactions'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import MoneyInput from '../../components/fields/MoneyInput'
import ScopeSelect from '../../components/fields/ScopeSelect'
import { useAccounts } from '../../hooks/useAccounts'
import { useCategories } from '../../hooks/useCategories'
import { useParties } from '../../hooks/useParties'
import { supabase } from '../../lib/supabaseClient'
import { toast } from 'sonner'

const formSchema = transactionSchema.extend({
  date: z.coerce.date(),
})

type FormValues = z.infer<typeof formSchema>

const PARTY_REQUIRED_FOR = new Set(['loan', 'sapati', 'bills', 'salary'])

export default function TransactionForm({ onCreated }: { onCreated?: () => void }) {
  const navigate = useNavigate()
  const { data: accounts } = useAccounts()
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { direction: 'out', scope: 'personal', date: new Date() } as any,
  })
  const scope = form.watch('scope') as 'personal' | 'work' | undefined
  const { data: categories } = useCategories(scope)
  const { data: parties } = useParties()

  const direction = form.watch('direction')
  const categoryId = form.watch('category_id')

  useEffect(() => {
    // If transfer, wipe category/party
    if (direction === 'transfer') {
      form.setValue('category_id', null)
      form.setValue('party_id', null)
    }
  }, [direction, form])

  useEffect(() => {
    // When scope changes, clear category and party to avoid cross-scope values
    form.setValue('category_id', null)
    form.setValue('party_id', null)
  }, [scope, form])

  const onSubmit = async (values: FormValues) => {
    if (!values.account_id) {
      toast.error('Please select an account')
      return
    }
    if (direction !== 'transfer') {
      if (values.amount == null || Number.isNaN(values.amount)) {
        toast.error('Amount is required')
        return
      }
      const needsParty = categories.find((c) => c.id === values.category_id)?.name
      if (needsParty && PARTY_REQUIRED_FOR.has(needsParty.toLowerCase()) && !values.party_id) {
        toast.error('Party required for selected category')
        return
      }
      const absolute = Math.abs(values.amount)
      const signedAmount = values.direction === 'out' ? -absolute : absolute
      const payload = {
        ...values,
        amount: signedAmount,
        qty: values.qty ?? null,
        date: values.date.toISOString().slice(0, 10),
      }
      setSubmitting(true)
      const { error } = await supabase.from('transactions').insert(payload as any)
      setSubmitting(false)
      if (error) return toast.error(error.message)
      toast.success('Transaction added')
      form.reset({ direction: 'out', scope: values.scope, date: new Date() } as any)
      onCreated?.()
    } else {
      const amt = Math.abs(values.amount || 0)
      navigate('/transfers', {
        state: {
          from_account: values.account_id,
          amount: amt > 0 ? amt : undefined,
        },
      })
      toast.info('Switched to Transfers form')
    }
  }

  const filteredCategories = categories.filter((c) => c.scope === (form.watch('scope') as any))
  const showParty = (() => {
    if (direction === 'transfer') return false
    const catName = categories.find((c) => c.id === categoryId)?.name?.toLowerCase()
    return catName ? PARTY_REQUIRED_FOR.has(catName) : false
  })()

  return (
    <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={form.handleSubmit(onSubmit)}>
      <div>
        <label className="text-sm">Date</label>
        <Input type="date" {...form.register('date')} />
      </div>
      <div>
        <label className="text-sm">Account</label>
        <select className="h-9 w-full border rounded-md px-2" {...form.register('account_id')}> 
          <option value="">Select account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm">Direction</label>
        <select className="h-9 w-full border rounded-md px-2" {...form.register('direction')}>
          <option value="in">Inflow</option>
          <option value="out">Outflow</option>
          <option value="transfer">Transfer</option>
        </select>
      </div>
      <div>
        <label className="text-sm">Scope</label>
        <ScopeSelect value={form.watch('scope') as any} onValueChange={(v) => form.setValue('scope', v)} />
      </div>
      {direction !== 'transfer' && (
        <div>
          <label className="text-sm">Category</label>
          <select className="h-9 w-full border rounded-md px-2" {...form.register('category_id')}>
            <option value="">Select category</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      {showParty && (
        <div>
          <label className="text-sm">Party</label>
          <select className="h-9 w-full border rounded-md px-2" {...form.register('party_id')}>
            <option value="">Select party</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="text-sm">Mode</label>
        <Input placeholder="cash, bank_transfer, etc" {...form.register('mode')} />
      </div>
      <div>
        <label className="text-sm">Quantity (optional)</label>
        <MoneyInput value={form.watch('qty') as any} onChange={(v) => form.setValue('qty', v as any)} />
      </div>
      <div>
        <label className="text-sm">Amount</label>
        <MoneyInput value={form.watch('amount') as any} onChange={(v) => form.setValue('amount', v as any)} />
      </div>
      <div className="md:col-span-2">
        <label className="text-sm">Notes</label>
        <Input placeholder="Optional" {...form.register('notes')} />
      </div>
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add Transaction'}</Button>
      </div>
    </form>
  )
}
