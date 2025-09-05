import { z } from 'zod'
import { idSchema } from './common'

export const staffSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  joined_on: z.coerce.date().optional().nullable(),
})

export type Staff = z.infer<typeof staffSchema> & { id: string }

