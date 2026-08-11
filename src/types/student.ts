import type { PaginationParams } from './pagination';

export type Gender = 'M' | 'F';
export type ParentRelationship = 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
export type AdmissionType = 'NEW_STUDENT' | 'TRANSFER';
export type StudentStatus = 'ACTIVE' | 'TRANSFERRED_OUT' | 'GRADUATED' | 'SUSPENDED';

export interface StudentClassroomSummary {
  classroomId: number;
  className: string;
  section: string;
  academicYear: string;
}

export interface StudentParentSummary {
  parentId: number;
  fullName: string;
  phoneNumber: string | null;
  relationship: ParentRelationship;
}

export interface StudentSummary {
  studentId: number;
  userId: number;
  username: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  address: string | null;
  enrolledAt: string;
  classroom: StudentClassroomSummary;
  parents: StudentParentSummary[];

  // Admission fields (already returned by the backend)
  admissionType: AdmissionType;
  studentStatus: StudentStatus;

  // Previous education (for NEW_STUDENT or TRANSFER)
  previousSchoolName?: string | null;
  previousSchoolType?: string | null;
  previousSchoolLocation?: string | null;
  lastGradeCompleted?: string | null;
  completionYear?: string | null;
  previousStudentId?: string | null;

  // Transfer-specific fields
  transferReason?: string | null;
  transferCertificateRef?: string | null;

  // Free-form JSON summary of previous academic records
  previousAcademicSummary?: unknown;

  // Transfer-out tracking (when this student leaves)
  transferredOutAt?: string | null;
  transferredOutDestination?: string | null;
  transferredOutReason?: string | null;
}

export interface IssuedCredentials {
  username: string;
  temporaryPassword: string;
}

export interface GuardianCredentialsIssued {
  fullName: string;
  username: string;
  temporaryPassword: string;
}

export interface CreateStudentResult {
  student: StudentSummary;
  credentials: IssuedCredentials;
  guardianCredentials: GuardianCredentialsIssued[];
}

export interface NewParentInput {
  fullName: string;
  phoneNumber?: string;
  email?: string;
}

export interface LinkParentInput {
  parentId?: number;
  newParent?: NewParentInput;
  relationship: ParentRelationship;
}

/** Payload sent to POST /students — matches backend createStudentSchema */
export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  address?: string;
  classroomId: number;
  parents?: LinkParentInput[];

  // Admission type (defaults to NEW_STUDENT on the backend)
  admissionType?: AdmissionType;

  // Previous education (used for both types)
  previousSchoolName?: string;
  previousSchoolType?: string;
  previousSchoolLocation?: string;
  lastGradeCompleted?: string;
  completionYear?: string;
  previousStudentId?: string;

  // Transfer-specific
  transferReason?: string;
  transferCertificateRef?: string;

  // Free-form JSON summary of previous academic performance
  previousAcademicSummary?: unknown;
}

/** Payload sent to POST /students/:id/transfer-out */
export interface TransferOutInput {
  transferredOutDestination?: string;
  transferredOutReason?: string;
}

/** Result from POST /students/bulk */
export interface BulkImportResult {
  successCount: number;
  errors: Array<{ student: string; error: string }>;
}

export interface ListStudentsParams extends PaginationParams {
  classroomId?: number;
  search?: string;
  admissionType?: AdmissionType;
  studentStatus?: StudentStatus;
}
