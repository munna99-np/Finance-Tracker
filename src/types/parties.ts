import { z } from 'zod'
import { idSchema } from './common'

export const partySchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type Party = z.infer<typeof partySchema> & { id: string }

