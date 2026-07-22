import type { PaginationParams } from './pagination';

export type Gender = 'M' | 'F';
export type ParentRelationship = 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';

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

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  address?: string;
  classroomId: number;
  parents?: LinkParentInput[];
}

export interface ListStudentsParams extends PaginationParams {
  classroomId?: number;
  search?: string;
}
