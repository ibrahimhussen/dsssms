import { z } from 'zod';

export const createStudentFormSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(100),
    lastName: z.string().trim().min(1, 'Last name is required').max(100),
    gender: z.enum(['M', 'F'], { errorMap: () => ({ message: 'Select a gender' }) }),
    dateOfBirth: z.string().min(1, 'Date of birth is required'),
    address: z.string().trim().max(255).optional(),
    classroomId: z.coerce.number().int().positive('Select a classroom'),
    addGuardian: z.boolean().default(false),
    guardianFullName: z.string().trim().max(255).optional(),
    guardianPhoneNumber: z.string().trim().max(20).optional(),
    guardianRelationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER']).optional(),
  })
  .refine((data) => !data.addGuardian || Boolean(data.guardianFullName), {
    message: "Guardian's full name is required",
    path: ['guardianFullName'],
  })
  .refine((data) => !data.addGuardian || Boolean(data.guardianRelationship), {
    message: 'Select the relationship to the student',
    path: ['guardianRelationship'],
  });

export type CreateStudentFormValues = z.infer<typeof createStudentFormSchema>;
