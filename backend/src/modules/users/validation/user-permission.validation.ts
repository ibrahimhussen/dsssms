import { z } from 'zod';

export const grantPermissionSchema = z.object({
  permission: z.string().min(1).max(100),
  expiresAt: z.coerce.date().optional(),
});

export const removePermissionParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  permissionId: z.coerce.number().int().positive(),
});

export type GrantPermissionInput = z.infer<typeof grantPermissionSchema>;
export type RemovePermissionParam = z.infer<typeof removePermissionParamSchema>;
