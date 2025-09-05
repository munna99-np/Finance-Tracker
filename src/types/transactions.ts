import { z } from 'zod'
import { idSchema, scopeEnum, directionEnum } from './common'

export const transactionSchema = z.object({
  id: idSchema.optional(),
  account_id: idSchema,
  date: z.coerce.date(),
  amount: z.number(),
  qty: z.number().optional().nullable(),
  direction: directionEnum,
  scope: scopeEnum,
  mode: z.string().optional().nullable(),
  category_id: idSchema.optional().nullable(),
  party_id: idSchema.optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type Transaction = z.infer<typeof transactionSchema> & { id: string }

export const transferSchema = z.object({
  id: idSchema.optional(),
  from_account: idSchema,
  to_account: idSchema,
  date: z.coerce.date(),
  amount: z.number().positive(),
  notes: z.string().optional().nullable(),
})

export type Transfer = z.infer<typeof transferSchema> & { id: string }
