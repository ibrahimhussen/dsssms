import { z } from 'zod';

// ── Shared Guardian Section ────────────────────────────────────────────────────

const guardianSection = z.object({
  addGuardian: z.boolean().default(false),
  guardianFullName: z.string().trim().max(255).optional(),
  guardianPhoneNumber: z.string().trim().max(20).optional(),
  guardianRelationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER']).optional(),
});

const guardianRefinements = <T extends z.ZodTypeAny>(schema: T) =>
  (schema as unknown as z.ZodObject<ReturnType<typeof guardianSection.shape.constructor>>)
    .refine((data: { addGuardian?: boolean; guardianFullName?: string }) => !data.addGuardian || Boolean(data.guardianFullName), {
      message: "Guardian's full name is required",
      path: ['guardianFullName'],
    })
    .refine((data: { addGuardian?: boolean; guardianRelationship?: string }) => !data.addGuardian || Boolean(data.guardianRelationship), {
      message: 'Select the relationship to the student',
      path: ['guardianRelationship'],
    });

// ── New Student Admission ─────────────────────────────────────────────────────

export const newAdmissionFormSchema = z
  .object({
    // Core student info
    firstName: z.string().trim().min(1, 'First name is required').max(100),
    lastName: z.string().trim().min(1, 'Last name is required').max(100),
    gender: z.enum(['M', 'F'], { required_error: 'Gender is required' }),
    dateOfBirth: z.string().min(1, 'Date of birth is required'),
    address: z.string().trim().max(255).optional(),
    classroomId: z.coerce.number().int().positive('Select a classroom'),

    // Previous education (optional for new students — they may come from primary school)
    previousSchoolName: z.string().trim().max(150).optional(),
    previousSchoolType: z.string().trim().max(50).optional(),
    previousSchoolLocation: z.string().trim().max(150).optional(),
    lastGradeCompleted: z.string().trim().max(20).optional(),
    completionYear: z.string().trim().max(10).optional(),
    previousStudentId: z.string().trim().max(50).optional(),

    // Guardian
    ...guardianSection.shape,
  })
  .refine((data) => !data.addGuardian || Boolean(data.guardianFullName), {
    message: "Guardian's full name is required",
    path: ['guardianFullName'],
  })
  .refine((data) => !data.addGuardian || Boolean(data.guardianRelationship), {
    message: 'Select the relationship to the student',
    path: ['guardianRelationship'],
  });

export type NewAdmissionFormValues = z.infer<typeof newAdmissionFormSchema>;

// ── Transfer Student Admission ────────────────────────────────────────────────

export const transferAdmissionFormSchema = z
  .object({
    // Core student info
    firstName: z.string().trim().min(1, 'First name is required').max(100),
    lastName: z.string().trim().min(1, 'Last name is required').max(100),
    gender: z.enum(['M', 'F'], { required_error: 'Gender is required' }),
    dateOfBirth: z.string().min(1, 'Date of birth is required'),
    address: z.string().trim().max(255).optional(),
    classroomId: z.coerce.number().int().positive('Select a classroom'),

    // Previous school (required for transfers — must be verified)
    previousSchoolName: z.string().trim().min(1, 'Previous school name is required').max(150),
    previousSchoolType: z.string().trim().max(50).optional(),
    previousSchoolLocation: z.string().trim().max(150).optional(),
    lastGradeCompleted: z.string().trim().min(1, 'Last grade completed is required').max(20),
    completionYear: z.string().trim().max(10).optional(),
    previousStudentId: z.string().trim().max(50).optional(),

    // Transfer details
    transferReason: z.string().trim().max(255).optional(),
    transferCertificateRef: z.string().trim().max(100).optional(),

    // Guardian
    ...guardianSection.shape,
  })
  .refine((data) => !data.addGuardian || Boolean(data.guardianFullName), {
    message: "Guardian's full name is required",
    path: ['guardianFullName'],
  })
  .refine((data) => !data.addGuardian || Boolean(data.guardianRelationship), {
    message: 'Select the relationship to the student',
    path: ['guardianRelationship'],
  });

export type TransferAdmissionFormValues = z.infer<typeof transferAdmissionFormSchema>;

// ── Transfer Out ──────────────────────────────────────────────────────────────

export const transferOutFormSchema = z.object({
  transferredOutDestination: z.string().trim().max(150).optional(),
  transferredOutReason: z.string().trim().max(255).optional(),
});

export type TransferOutFormValues = z.infer<typeof transferOutFormSchema>;

// ── Legacy (keep for backward compatibility) ──────────────────────────────────

export const createStudentFormSchema = newAdmissionFormSchema;
export type CreateStudentFormValues = NewAdmissionFormValues;
