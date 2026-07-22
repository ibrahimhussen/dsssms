import { z } from 'zod';

export const createSubjectFormSchema = z.object({
  subjectCode: z.string().trim().min(1, 'Subject code is required').max(20),
  subjectName: z.string().trim().min(1, 'Subject name is required').max(100),
});

export type CreateSubjectFormValues = z.infer<typeof createSubjectFormSchema>;
