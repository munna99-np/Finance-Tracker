import { z } from 'zod'

export const scopeEnum = z.enum(['personal', 'work'])
export type Scope = z.infer<typeof scopeEnum>

export const directionEnum = z.enum(['in', 'out', 'transfer'])
export type Direction = z.infer<typeof directionEnum>

export const modeEnum = z.string().min(1).optional()
export type Mode = string | undefined

export const idSchema = z.string().uuid()

export type UUID = string

