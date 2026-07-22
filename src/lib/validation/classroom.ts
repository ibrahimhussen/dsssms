import { z } from 'zod';

export const createClassroomFormSchema = z.object({
  className: z.string().trim().min(1, 'Class name is required').max(50),
  section: z.string().trim().min(1, 'Section is required').max(10),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}(\/\d{2,4})?$/, 'Use a format like "2025" or "2025/26"'),
  homeroomTeacherId: z.coerce.number().int().positive().optional(),
});

export type CreateClassroomFormValues = z.infer<typeof createClassroomFormSchema>;
