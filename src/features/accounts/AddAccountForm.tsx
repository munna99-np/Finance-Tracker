import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { supabase } from '../../lib/supabaseClient'
import { toast } from 'sonner'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  kind: z.enum(['personal', 'company']),
  opening_balance: z.coerce.number().default(0),
})

type FormValues = z.infer<typeof schema>

export default function AddAccountForm({ onCreated }: { onCreated?: () => void }) {
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { kind: 'personal', opening_balance: 0 },
  })

  const onSubmit = async (values: FormValues) => {
    const { error } = await supabase.from('accounts').insert(values as any)
    if (error) return toast.error(error.message)
    toast.success('Account created')
    reset({ name: '', kind: 'personal', opening_balance: 0 })
    onCreated?.()
  }

  return (
    <form className="flex flex-col md:flex-row gap-2" onSubmit={handleSubmit(onSubmit)}>
      <Input placeholder="Account name" {...register('name')} />
      <select className="h-9 border rounded-md px-2" {...register('kind')}>
        <option value="personal">Personal</option>
        <option value="company">Company</option>
      </select>
      <Input placeholder="Opening balance" inputMode="decimal" {...register('opening_balance')} />
      <Button type="submit">Add</Button>
      {formState.errors.name && (
        <div className="text-sm text-red-600">{formState.errors.name.message}</div>
      )}
    </form>
  )
}

