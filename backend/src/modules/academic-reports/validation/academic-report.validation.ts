import { z } from 'zod';
import { Semester } from '@prisma/client';

const academicYearField = z
  .string()
  .trim()
  .regex(/^\d{4}(\/\d{2,4})?$/, 'Academic year must look like "2025" or "2025/26"');

export const generateClassroomReportsSchema = z.object({
  classroomId: z.coerce.number().int().positive(),
  semester: z.nativeEnum(Semester),
  academicYear: academicYearField,
});

export const reportPeriodQuerySchema = z.object({
  semester: z.nativeEnum(Semester),
  academicYear: academicYearField,
});

export const studentIdParamSchema = z.object({
  studentId: z.coerce.number().int().positive(),
});

export type GenerateClassroomReportsInput = z.infer<typeof generateClassroomReportsSchema>;
export type ReportPeriodQuery = z.infer<typeof reportPeriodQuerySchema>;
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
