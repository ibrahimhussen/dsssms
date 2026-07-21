import { z } from 'zod';
import { Gender } from '@prisma/client';
import { paginationQuerySchema } from '../../../core/http/pagination';
import { linkParentToStudentSchema } from '../../parents/validation/parent.validation';

export const createStudentSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  gender: z.nativeEnum(Gender),
  dateOfBirth: z.coerce.date({ errorMap: () => ({ message: 'A valid date of birth is required' }) }),
  address: z.string().trim().max(255).optional(),
  classroomId: z.coerce.number().int().positive('classroomId is required'),
  // Optional guardians to link at the moment of registration.
  parents: z.array(linkParentToStudentSchema).max(5).optional(),
});

export const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  address: z.string().trim().max(255).optional(),
  dateOfBirth: z.coerce.date().optional(),
});

export const transferClassroomSchema = z.object({
  classroomId: z.coerce.number().int().positive(),
});

export const listStudentsQuerySchema = paginationQuerySchema.extend({
  classroomId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(150).optional(),
});

export const studentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const removeParentLinkParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  parentId: z.coerce.number().int().positive(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type TransferClassroomInput = z.infer<typeof transferClassroomSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
export type RemoveParentLinkParam = z.infer<typeof removeParentLinkParamSchema>;
