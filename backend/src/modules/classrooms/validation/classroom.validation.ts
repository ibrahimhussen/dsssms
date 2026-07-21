import { z } from 'zod';
import { paginationQuerySchema } from '../../../core/http/pagination';

export const createClassroomSchema = z.object({
  className: z.string().trim().min(1, 'Class name is required').max(50),
  section: z.string().trim().min(1, 'Section is required').max(10),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}(\/\d{2,4})?$/, 'Academic year must look like "2025" or "2025/26"'),
  homeroomTeacherId: z.coerce.number().int().positive().optional(),
});

export const updateClassroomSchema = z.object({
  className: z.string().trim().min(1).max(50).optional(),
  section: z.string().trim().min(1).max(10).optional(),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}(\/\d{2,4})?$/, 'Academic year must look like "2025" or "2025/26"')
    .optional(),
  homeroomTeacherId: z.coerce.number().int().positive().nullable().optional(),
});

export const listClassroomsQuerySchema = paginationQuerySchema.extend({
  academicYear: z.string().trim().max(10).optional(),
  search: z.string().trim().max(100).optional(),
});

export const classroomIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;
export type UpdateClassroomInput = z.infer<typeof updateClassroomSchema>;
export type ListClassroomsQuery = z.infer<typeof listClassroomsQuerySchema>;
export type ClassroomIdParam = z.infer<typeof classroomIdParamSchema>;
