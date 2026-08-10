import { Gender, ParentRelationship, AdmissionType, StudentStatus } from '@prisma/client';

export interface StudentParentSummary {
  parentId: number;
  fullName: string;
  phoneNumber: string | null;
  relationship: ParentRelationship;
}

export interface StudentClassroomSummary {
  classroomId: number;
  className: string;
  section: string;
  academicYear: string;
}

export interface StudentSummaryDto {
  studentId: number;
  userId: number;
  username: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: Date;
  address: string | null;
  enrolledAt: Date;
  classroom: StudentClassroomSummary;
  parents: StudentParentSummary[];

  admissionType: AdmissionType;
  studentStatus: StudentStatus;
  previousSchoolName?: string | null;
  previousSchoolType?: string | null;
  previousSchoolLocation?: string | null;
  lastGradeCompleted?: string | null;
  completionYear?: string | null;
  previousStudentId?: string | null;
  transferReason?: string | null;
  transferCertificateRef?: string | null;
  previousAcademicSummary?: any;
  transferredOutAt?: Date | null;
  transferredOutDestination?: string | null;
  transferredOutReason?: string | null;
}

export interface GuardianCredentialsIssuedDto {
  fullName: string;
  username: string;
  temporaryPassword: string;
}

export interface CreateStudentResultDto {
  student: StudentSummaryDto;
  credentials: { username: string; temporaryPassword: string };
  /** Populated only for guardians that were newly created (not linked to an existing parentId) during this call. */
  guardianCredentials: GuardianCredentialsIssuedDto[];
}
