import { z } from 'zod';
import { AttendanceStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../../core/http/pagination';

function isNotFutureDate(date: Date): boolean {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return date <= endOfToday;
}

const attendanceDateField = z.coerce
  .date({ message: 'A valid attendance date is required' })
  .refine(isNotFutureDate, { message: 'Attendance date cannot be in the future' });

export const bulkMarkAttendanceSchema = z.object({
  classroomId: z.coerce.number().int().positive(),
  period: z.coerce.number().int().nonnegative().default(0),
  attendanceDate: attendanceDateField,
  records: z
    .array(
      z.object({
        studentId: z.coerce.number().int().positive(),
        status: z.nativeEnum(AttendanceStatus),
        remarks: z.string().trim().max(255).optional(),
      })
    )
    .min(1, 'At least one attendance record is required')
    .max(200),
});

export const updateAttendanceSchema = z
  .object({
    status: z.nativeEnum(AttendanceStatus).optional(),
    remarks: z.string().trim().max(255).optional(),
  })
  .refine((data) => data.status !== undefined || data.remarks !== undefined, {
    message: 'Provide at least one field to update',
  });

export const classroomAttendanceQuerySchema = z.object({
  classroomId: z.coerce.number().int().positive(),
  period: z.coerce.number().int().nonnegative().default(0),
  attendanceDate: attendanceDateField,
});

export const classroomAttendanceRangeQuerySchema = z.object({
  classroomId: z.coerce.number().int().positive(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const studentAttendanceQuerySchema = paginationQuerySchema.extend({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const attendanceSummaryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const attendanceIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const studentIdParamSchema = z.object({
  studentId: z.coerce.number().int().positive(),
});

export type BulkMarkAttendanceInput = z.infer<typeof bulkMarkAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type ClassroomAttendanceQuery = z.infer<typeof classroomAttendanceQuerySchema>;
export type ClassroomAttendanceRangeQuery = z.infer<typeof classroomAttendanceRangeQuerySchema>;
export type StudentAttendanceQuery = z.infer<typeof studentAttendanceQuerySchema>;
export type AttendanceSummaryQuery = z.infer<typeof attendanceSummaryQuerySchema>;
export type AttendanceIdParam = z.infer<typeof attendanceIdParamSchema>;
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
