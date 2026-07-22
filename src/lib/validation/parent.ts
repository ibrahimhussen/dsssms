import { z } from 'zod';

export const createParentFormSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(255),
  phoneNumber: z.string().trim().max(20).optional(),
  email: z.union([z.string().trim().email('Invalid email address'), z.literal('')]).optional(),
});

export type CreateParentFormValues = z.infer<typeof createParentFormSchema>;
