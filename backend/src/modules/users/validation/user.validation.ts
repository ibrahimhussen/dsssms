import { z } from 'zod';
import { RoleName, UserStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../../core/http/pagination';

export const createStaffSchema = z.object({
  role: z.nativeEnum(RoleName),
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.string().trim().email('Invalid email address').optional(),
  phoneNumber: z.string().trim().max(20).optional(),
  qualification: z.string().trim().max(255).optional(),
  specialization: z.string().trim().max(255).optional(),
});

export const listUsersQuerySchema = paginationQuerySchema.extend({
  role: z.nativeEnum(RoleName).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().trim().max(150).optional(),
});

export const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

/** Payload for replacing the current active Director or Vice Director. */
export const replaceOfficeSchema = z.object({
  /** The role being replaced — must be DIRECTOR or VICE_DIRECTOR. */
  role: z.union([z.literal('DIRECTOR'), z.literal('VICE_DIRECTOR')]),
  /** userId of the current active officeholder being replaced. */
  outgoingUserId: z.number().int().positive(),
  /** Details for the incoming replacement. */
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName:  z.string().trim().min(1, 'Last name is required').max(100),
  email:     z.string().trim().email('Invalid email address').optional(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type ListUsersQuery   = z.infer<typeof listUsersQuerySchema>;
export type UserIdParam      = z.infer<typeof userIdParamSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type ReplaceOfficeInput    = z.infer<typeof replaceOfficeSchema>;
