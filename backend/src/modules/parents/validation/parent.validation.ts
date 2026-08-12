import { z } from 'zod';
import { ParentRelationship } from '@prisma/client';
import { paginationQuerySchema } from '../../../core/http/pagination';

export const createParentSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(255),
  phoneNumber: z.string().trim().max(20).optional(),
  email: z.string().trim().email('Invalid email address').optional(),
});

export const linkParentToStudentSchema = z.object({
  // Either link an existing parent by id, or provide new-parent details to create one.
  parentId: z.coerce.number().int().positive().optional(),
  newParent: createParentSchema.optional(),
  relationship: z.nativeEnum(ParentRelationship),
}).refine((data) => (data.parentId !== undefined) !== (data.newParent !== undefined), {
  message: 'Provide exactly one of parentId (existing parent) or newParent (new parent details)',
});

export const listParentsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(150).optional(),
});

export const parentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateParentInput = z.infer<typeof createParentSchema>;
export type LinkParentToStudentInput = z.infer<typeof linkParentToStudentSchema>;
export type ListParentsQuery = z.infer<typeof listParentsQuerySchema>;
export type ParentIdParam = z.infer<typeof parentIdParamSchema>;
