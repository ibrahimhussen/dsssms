import { z } from 'zod';

export const systemSettingFormSchema = z.object({
  schoolName: z.string().trim().min(1, 'School name is required').max(150),
  schoolAddress: z.string().trim().max(255).optional(),
  contactEmail: z.union([z.string().trim().email('Invalid email address'), z.literal('')]).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  currentAcademicYear: z
    .string()
    .trim()
    .regex(/^\d{4}(\/\d{2,4})?$/, 'Academic year must look like "2025" or "2025/26"'),
});

export type SystemSettingFormValues = z.infer<typeof systemSettingFormSchema>;
