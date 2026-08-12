import { z } from 'zod';
import { Semester, ConductRating } from '@prisma/client';

const academicYearField = z
  .string()
  .trim()
  .regex(/^\d{4}\/\d{2}$/, 'Academic year must be in format YYYY/YY');

export const createConductSchema = z.object({
  studentId: z.coerce.number().int().positive(),
  classroomId: z.coerce.number().int().positive(),
  academicYear: academicYearField,
  semester: z.nativeEnum(Semester),
  rating: z.nativeEnum(ConductRating),
  notes: z.string().max(500).optional(),
});

export const updateConductSchema = z.object({
  rating: z.nativeEnum(ConductRating).optional(),
  notes: z.string().max(500).optional(),
});

export const conductIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const classroomConductQuerySchema = z.object({
  classroomId: z.coerce.number().int().positive(),
  semester: z.nativeEnum(Semester),
  academicYear: academicYearField,
});

export type CreateConductInput = z.infer<typeof createConductSchema>;
export type UpdateConductInput = z.infer<typeof updateConductSchema>;