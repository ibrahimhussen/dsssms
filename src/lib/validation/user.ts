import { z } from 'zod';

export const createStaffFormSchema = z.object({
  role: z.enum(['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR', 'TEACHER'], {
    errorMap: () => ({ message: 'Select a role' }),
  }),
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.union([z.string().trim().email('Invalid email address'), z.literal('')]).optional(),
  phoneNumber: z.string().trim().max(20).optional(),
  qualification: z.string().trim().max(255).optional(),
  specialization: z.string().trim().max(255).optional(),
});

export type CreateStaffFormValues = z.infer<typeof createStaffFormSchema>;
