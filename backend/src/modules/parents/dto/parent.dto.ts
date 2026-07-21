import { ParentRelationship } from '@prisma/client';

export interface LinkedStudentDto {
  studentId: number;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  relationship: ParentRelationship;
}

export interface ParentSummaryDto {
  parentId: number;
  userId: number;
  username: string;
  fullName: string;
  phoneNumber: string | null;
  email: string | null;
  children: LinkedStudentDto[];
}

export interface CreateParentResultDto {
  parent: ParentSummaryDto;
  credentials: { username: string; temporaryPassword: string };
}
