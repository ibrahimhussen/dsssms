// ── Inputs (sent to backend) ──────────────────────────────────────────────────

export interface SubmitForReviewInput {
  teacherSubjectId: number;
  semester: 'SEMESTER_1' | 'SEMESTER_2';
  academicYear: string;
}

export interface ReviewSubjectInput {
  teacherSubjectId: number;
  semester: 'SEMESTER_1' | 'SEMESTER_2';
  academicYear: string;
  approved: boolean;
  reviewNotes?: string;
}

export interface FinalizeSubjectInput {
  teacherSubjectId: number;
  semester: 'SEMESTER_1' | 'SEMESTER_2';
  academicYear: string;
}

export interface FinalizeClassroomInput {
  classroomId: number;
  semester: 'SEMESTER_1' | 'SEMESTER_2';
  academicYear: string;
}

export interface CorrectFinalizationInput {
  correctionReason: string;
}

// ── DTOs (received from backend) ─────────────────────────────────────────────

/** Matches Prisma FinalizationStatus enum exactly */
export type FinalizationStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'FINALIZED';

export interface SubjectFinalization {
  id: number;
  teacherSubjectId: number;
  subjectName: string;
  teacherName: string;
  semester: string;
  academicYear: string;
  status: FinalizationStatus;
  reviewedAt?: string | null;
  reviewedBy?: number | null;
  reviewedByUser?: {
    userId: number;
    firstName: string;
    lastName: string;
  };
  finalizedAt?: string | null;
  finalizedBy?: number | null;
  finalizedByUser?: {
    userId: number;
    firstName: string;
    lastName: string;
  };
  correctionReason?: string | null;
  lastCorrectionAt?: string | null;
  createdAt: string;
  updatedAt: string;
  studentCount: number;
  missingResultsCount: number;
}

export interface ClassroomFinalization {
  id: number;
  classroomId: number;
  semester: string;
  academicYear: string;
  status: FinalizationStatus;
  finalizedAt?: string | null;
  finalizedBy?: number | null;
  correctionReason?: string | null;
  lastCorrectionAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
