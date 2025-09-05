import { z } from 'zod'
import { idSchema } from './common'

export const staffAdvanceSchema = z.object({
  id: idSchema.optional(),
  staff_id: idSchema,
  date: z.coerce.date(),
  amount: z.number().positive(),
  notes: z.string().optional().nullable(),
})

export type StaffAdvance = z.infer<typeof staffAdvanceSchema> & { id: string }

