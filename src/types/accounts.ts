import { z } from 'zod'
import { idSchema } from './common'

export const accountKindEnum = z.enum(['personal', 'company'])

export const accountSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1),
  kind: accountKindEnum,
  opening_balance: z.coerce.number(),
  is_active: z.boolean().default(true),
})

export type Account = z.infer<typeof accountSchema> & { id: string }

