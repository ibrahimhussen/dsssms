import { z } from 'zod';
import { Gender, AdmissionType, StudentStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../../core/http/pagination';
import { linkParentToStudentSchema } from '../../parents/validation/parent.validation';

export const createStudentSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  gender: z.nativeEnum(Gender),
  dateOfBirth: z.coerce.date({ required_error: 'A valid date of birth is required', invalid_type_error: 'A valid date of birth is required' }),
  address: z.string().trim().max(255).optional(),
  classroomId: z.coerce.number().int().positive('classroomId is required'),
  // Optional guardians to link at the moment of registration.
  parents: z.array(linkParentToStudentSchema).max(5).optional(),

  // New Admission and Transfer fields
  admissionType: z.nativeEnum(AdmissionType).optional(),
  previousSchoolName: z.string().trim().max(150).optional().nullable(),
  previousSchoolType: z.string().trim().max(50).optional().nullable(),
  previousSchoolLocation: z.string().trim().max(150).optional().nullable(),
  lastGradeCompleted: z.string().trim().max(20).optional().nullable(),
  completionYear: z.string().trim().max(10).optional().nullable(),
  previousStudentId: z.string().trim().max(50).optional().nullable(),
  transferReason: z.string().trim().max(255).optional().nullable(),
  transferCertificateRef: z.string().trim().max(100).optional().nullable(),
  previousAcademicSummary: z.any().optional().nullable(),
});

export const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  address: z.string().trim().max(255).optional(),
  dateOfBirth: z.coerce.date().optional(),
});

export const transferClassroomSchema = z.object({
  classroomId: z.coerce.number().int().positive(),
});

export const listStudentsQuerySchema = paginationQuerySchema.extend({
  classroomId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(150).optional(),
});

export const studentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const removeParentLinkParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  parentId: z.coerce.number().int().positive(),
});

export const transferOutSchema = z.object({
  transferredOutDestination: z.string().trim().max(150).optional(),
  transferredOutReason: z.string().trim().max(255).optional(),
});

export const bulkImportSchema = z.object({
  students: z.array(createStudentSchema).min(1).max(500),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type TransferClassroomInput = z.infer<typeof transferClassroomSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
export type RemoveParentLinkParam = z.infer<typeof removeParentLinkParamSchema>;
export type TransferOutInput = z.infer<typeof transferOutSchema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
