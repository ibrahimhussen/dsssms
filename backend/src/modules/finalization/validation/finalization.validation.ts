import { z } from 'zod';
import { Semester } from '@prisma/client';

const academicYearField = z
  .string()
  .trim()
  .regex(/^\d{4}\/\d{2}$/, 'Academic year must be in format YYYY/YY');

export const submitForReviewSchema = z.object({
  teacherSubjectId: z.coerce.number().int().positive(),
  semester: z.nativeEnum(Semester),
  academicYear: academicYearField,
});

export const reviewSubjectSchema = z.object({
  teacherSubjectId: z.coerce.number().int().positive(),
  semester: z.nativeEnum(Semester),
  academicYear: academicYearField,
  approved: z.boolean(),
  reviewNotes: z.string().max(500).optional(),
});

export const finalizeSubjectSchema = z.object({
  teacherSubjectId: z.coerce.number().int().positive(),
  semester: z.nativeEnum(Semester),
  academicYear: academicYearField,
});

export const finalizeClassroomSchema = z.object({
  classroomId: z.coerce.number().int().positive(),
  semester: z.nativeEnum(Semester),
  academicYear: academicYearField,
});

export const correctFinalizationSchema = z.object({
  correctionReason: z.string().min(1).max(500),
});

export const subjectFinalizationIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const classroomFinalizationIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type SubmitForReviewInput = z.infer<typeof submitForReviewSchema>;
export type ReviewSubjectInput = z.infer<typeof reviewSubjectSchema>;
export type FinalizeSubjectInput = z.infer<typeof finalizeSubjectSchema>;
export type FinalizeClassroomInput = z.infer<typeof finalizeClassroomSchema>;
export type CorrectFinalizationInput = z.infer<typeof correctFinalizationSchema>;