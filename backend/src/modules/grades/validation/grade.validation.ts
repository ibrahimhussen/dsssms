import { z } from 'zod';
import { Semester } from '@prisma/client';
import { paginationQuerySchema } from '../../../core/http/pagination';

const scoreField = z.coerce.number().min(0, 'Score cannot be negative').max(100, 'Score cannot exceed 100');
const academicYearField = z
  .string()
  .trim()
  .regex(/^\d{4}(\/\d{2,4})?$/, 'Academic year must look like "2025" or "2025/26"');

export const bulkRecordGradesSchema = z.object({
  classroomId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  semester: z.nativeEnum(Semester),
  academicYear: academicYearField,
  records: z
    .array(
      z.object({
        studentId: z.coerce.number().int().positive(),
        score: scoreField,
      })
    )
    .min(1, 'At least one grade record is required')
    .max(200),
});

export const updateGradeSchema = z.object({
  score: scoreField,
});

export const classroomGradesQuerySchema = z.object({
  classroomId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  semester: z.nativeEnum(Semester),
  academicYear: academicYearField,
});

export const studentGradesQuerySchema = paginationQuerySchema.extend({
  semester: z.nativeEnum(Semester).optional(),
  academicYear: academicYearField.optional(),
});

export const gradeIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const studentIdParamSchema = z.object({
  studentId: z.coerce.number().int().positive(),
});

export type BulkRecordGradesInput = z.infer<typeof bulkRecordGradesSchema>;
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>;
export type ClassroomGradesQuery = z.infer<typeof classroomGradesQuerySchema>;
export type StudentGradesQuery = z.infer<typeof studentGradesQuerySchema>;
export type GradeIdParam = z.infer<typeof gradeIdParamSchema>;
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
