import { z } from 'zod'
import { idSchema } from './common'

export const staffSalarySchema = z.object({
  id: idSchema.optional(),
  staff_id: idSchema,
  period: z.coerce.date(),
  amount: z.number().nonnegative(),
  paid_on: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type StaffSalary = z.infer<typeof staffSalarySchema> & { id: string }

