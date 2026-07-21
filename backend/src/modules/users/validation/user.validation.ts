import { z } from 'zod';
import { RoleName, UserStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../../core/http/pagination';

const STAFF_ROLES = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.TEACHER] as const;

export const createStaffSchema = z.object({
  role: z.enum(STAFF_ROLES, { errorMap: () => ({ message: 'Role must be one of ADMIN, DIRECTOR, VICE_DIRECTOR, TEACHER' }) }),
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

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
