import { Gender, ParentRelationship } from '@prisma/client';

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
  dateOfBirth: string;
  address: string | null;
  enrolledAt: string;
  classroom: StudentClassroomSummary;
  parents: StudentParentSummary[];
}

export interface GuardianCredentialsIssuedDto {
  fullName: string;
  username: string;
  temporaryPassword: string;
}

export interface CreateStudentResultDto {
  student: StudentSummaryDto;
  credentials: { username: string; temporaryPassword: string };
  guardianCredentials: GuardianCredentialsIssuedDto[];
}
