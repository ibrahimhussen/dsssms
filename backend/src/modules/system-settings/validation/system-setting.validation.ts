import { z } from 'zod';

export const updateSystemSettingSchema = z.object({
  schoolName: z.string().trim().min(1, 'School name is required').max(150),
  schoolAddress: z.string().trim().max(255).optional(),
  schoolZone: z.string().trim().max(100).optional(),
  schoolWereda: z.string().trim().max(100).optional(),
  contactEmail: z.string().trim().email('Invalid email address').max(150).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  currentAcademicYear: z
    .string()
    .trim()
    .regex(/^\d{4}(\/\d{2,4})?$/, 'Academic year must look like "2025" or "2025/26"'),
  schoolLogo: z.string().trim().max(4_000_000).optional(), // URL or base64 data URL (max ~3MB)
});

export type UpdateSystemSettingInput = z.infer<typeof updateSystemSettingSchema>;
