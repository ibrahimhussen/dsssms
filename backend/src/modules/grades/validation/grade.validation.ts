import { z } from 'zod';
import { GradeCategory, Semester } from '@prisma/client';

const academicYearField = z
  .string()
  .trim()
  .regex(/^\d{4}(\/\d{2,4})?$/, 'Academic year must look like "2025" or "2025/26"');

const maxMarksField = z.coerce.number().positive({ message: 'Max marks must be greater than 0' }).max(100);

export const createGradeComponentSchema = z
  .object({
    teacherSubjectId: z.coerce.number().int().positive(),
    semester: z.nativeEnum(Semester),
    academicYear: academicYearField,
    category: z.nativeEnum(GradeCategory),
    name: z.string().trim().min(1, 'Name is required').max(100),
    maxMarks: maxMarksField,
  })
  .refine((data) => data.category !== GradeCategory.FINAL_EXAM || data.maxMarks === 50, {
    message: 'Final Exam must be worth exactly 50 marks',
    path: ['maxMarks'],
  });

export const gradeComponentQuerySchema = z.object({
  teacherSubjectId: z.coerce.number().int().positive(),
  semester: z.nativeEnum(Semester),
  academicYear: academicYearField,
});

export const gradeComponentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const recordComponentEntriesSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: z.coerce.number().int().positive(),
        score: z.coerce.number().min(0, { message: 'Score cannot be negative' }),
      })
    )
    .min(1, 'At least one score is required')
    .max(200),
});

export const studentGradesQuerySchema = z.object({
  semester: z.nativeEnum(Semester).optional(),
  academicYear: academicYearField.optional(),
});

export const studentIdParamSchema = z.object({
  studentId: z.coerce.number().int().positive(),
});

export type CreateGradeComponentInput = z.infer<typeof createGradeComponentSchema>;
export type GradeComponentQuery = z.infer<typeof gradeComponentQuerySchema>;
export type GradeComponentIdParam = z.infer<typeof gradeComponentIdParamSchema>;
export type RecordComponentEntriesInput = z.infer<typeof recordComponentEntriesSchema>;
export type StudentGradesQuery = z.infer<typeof studentGradesQuerySchema>;
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
