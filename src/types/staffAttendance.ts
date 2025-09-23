import { z } from 'zod'
import { idSchema } from './common'

export const staffAttendanceSchema = z.object({
  id: idSchema.optional(),
  staff_id: idSchema,
  date: z.coerce.date(),
  status: z.enum(['present','absent','leave']).default('present'),
  notes: z.string().optional().nullable(),
})

export type StaffAttendance = z.infer<typeof staffAttendanceSchema> & { id: string }
export type StaffAttendanceStatus = z.infer<typeof staffAttendanceSchema>['status']
