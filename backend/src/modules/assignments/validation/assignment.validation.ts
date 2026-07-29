import { z } from 'zod';
import { SubmissionStatus } from '@prisma/client';

export const createAssignmentSchema = z.object({
  teacherSubjectId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, 'Title is required').max(150),
  description: z.string().trim().max(2000).optional(),
  dueDate: z.coerce.date({ errorMap: () => ({ message: 'A valid due date is required' }) }),
});

export const listAssignmentsQuerySchema = z.object({
  teacherSubjectId: z.coerce.number().int().positive().optional(),
});

export const assignmentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const assignmentStudentParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  studentId: z.coerce.number().int().positive(),
});

/** Teacher correcting/marking a specific student's submission. */
export const updateSubmissionStatusSchema = z.object({
  status: z.nativeEnum(SubmissionStatus),
  notes: z.string().trim().max(500).optional(),
});

/** Student self-reporting their own completion of an assignment. */
export const markMySubmissionSchema = z.object({
  submitted: z.boolean(),
  notes: z.string().trim().max(500).optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;
export type AssignmentIdParam = z.infer<typeof assignmentIdParamSchema>;
export type AssignmentStudentParam = z.infer<typeof assignmentStudentParamSchema>;
export type UpdateSubmissionStatusInput = z.infer<typeof updateSubmissionStatusSchema>;
export type MarkMySubmissionInput = z.infer<typeof markMySubmissionSchema>;
