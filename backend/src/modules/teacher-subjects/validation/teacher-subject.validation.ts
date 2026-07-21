import { z } from 'zod';
import { paginationQuerySchema } from '../../../core/http/pagination';

export const createAssignmentSchema = z.object({
  teacherId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  classroomId: z.coerce.number().int().positive(),
});

export const listAssignmentsQuerySchema = paginationQuerySchema.extend({
  teacherId: z.coerce.number().int().positive().optional(),
  classroomId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
});

export const assignmentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;
export type AssignmentIdParam = z.infer<typeof assignmentIdParamSchema>;
