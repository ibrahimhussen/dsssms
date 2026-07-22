import type { ParentRelationship } from './student';

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
