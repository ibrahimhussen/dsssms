import { z } from 'zod';
import { paginationQuerySchema } from '../../../core/http/pagination';

export const createSubjectSchema = z.object({
  subjectCode: z
    .string()
    .trim()
    .min(1, 'Subject code is required')
    .max(20)
    .transform((s) => s.toUpperCase()),
  subjectName: z.string().trim().min(1, 'Subject name is required').max(100),
});

export const updateSubjectSchema = z.object({
  subjectCode: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((s) => s.toUpperCase())
    .optional(),
  subjectName: z.string().trim().min(1).max(100).optional(),
});

export const listSubjectsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
});

export const subjectIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type ListSubjectsQuery = z.infer<typeof listSubjectsQuerySchema>;
export type SubjectIdParam = z.infer<typeof subjectIdParamSchema>;
