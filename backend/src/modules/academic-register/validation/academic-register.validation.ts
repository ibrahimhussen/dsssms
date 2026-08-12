import { z } from 'zod';
import { Semester } from '@prisma/client';

const academicYearField = z
  .string()
  .trim()
  .regex(/^\d{4}\/\d{2}$/, 'Academic year must be in format YYYY/YY');

export const classroomRegisterSchema = z.object({
  classroomId: z.coerce.number().int().positive().optional(),
  academicYear: academicYearField,
  semester: z.nativeEnum(Semester),
  grade: z.string().optional(),
  section: z.string().optional(),
  gradeWide: z.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const gradeSummarySchema = z.object({
  grade: z.string(),
  academicYear: academicYearField,
  semester: z.nativeEnum(Semester),
});

export const historicalRegisterSchema = z.object({
  studentId: z.coerce.number().int().positive(),
  academicYear: academicYearField,
  semester: z.nativeEnum(Semester),
});

export type AcademicRegisterQuery = z.infer<typeof classroomRegisterSchema>;