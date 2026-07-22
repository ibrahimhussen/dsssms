import type { PaginationParams } from './pagination';
import type { ParentRelationship } from './student';

export type { ParentRelationship };

export interface LinkedStudent {
  studentId: number;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  relationship: ParentRelationship;
}

export interface ParentSummary {
  parentId: number;
  userId: number;
  username: string;
  fullName: string;
  phoneNumber: string | null;
  email: string | null;
  children: LinkedStudent[];
}

export interface CreateParentInput {
  fullName: string;
  phoneNumber?: string;
  email?: string;
}

export interface CreateParentResult {
  parent: ParentSummary;
  credentials: { username: string; temporaryPassword: string };
}

export interface ListParentsParams extends PaginationParams {
  search?: string;
}
