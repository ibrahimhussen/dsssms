import { z } from 'zod';

export const createAssignmentFormSchema = z.object({
  teacherId: z.coerce.number().int().positive('Select a teacher'),
  subjectId: z.coerce.number().int().positive('Select a subject'),
  classroomId: z.coerce.number().int().positive('Select a classroom'),
});

export type CreateAssignmentFormValues = z.infer<typeof createAssignmentFormSchema>;
