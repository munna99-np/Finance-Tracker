import { z } from 'zod'
import { idSchema } from './common'
import { scopeEnum } from './common'

export const categorySchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1),
  scope: scopeEnum,
  parent_id: idSchema.nullable().optional(),
})

export type Category = z.infer<typeof categorySchema> & { id: string }

