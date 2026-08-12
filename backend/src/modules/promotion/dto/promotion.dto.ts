import {
  BatchStatus,
  EligibilityStatus,
  EnrollmentDecision,
  PromotionDecision,
} from '@prisma/client';

// ── Enrollment history ────────────────────────────────────────────────────────

export interface StudentEnrollmentDto {
  id: number;
  studentId: number;
  classroomId: number;
  classroomLabel: string; // "Grade 9 A (2025/26)"
  academicYear: string;
  decision: EnrollmentDecision;
  batchId: number | null;
  notes: string | null;
  createdAt: string;
}

// ── Promotion entry (one student inside a batch) ──────────────────────────────

export interface PromotionEntryDto {
  id: number;
  batchId: number;
  studentId: number;
  admissionNumber: string;
  studentName: string;
  eligibilityStatus: EligibilityStatus;
  decision: PromotionDecision;
  targetClassroomId: number | null;
  targetClassroomLabel: string | null;
  averageMark: number | null;
  attendancePercent: number | null;
  overrideReason: string | null;
}

// ── Batch summary (list view) ─────────────────────────────────────────────────

export interface PromotionBatchSummaryDto {
  id: number;
  sourceAcademicYear: string;
  targetAcademicYear: string;
  sourceClassroomId: number;
  sourceClassroomLabel: string;
  status: BatchStatus;
  preparedBy: string;
  approvedBy: string | null;
  totalStudents: number;
  eligibleCount: number;
  pendingCount: number;
  notEligibleCount: number;
  submittedAt: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

// ── Batch detail (includes all entries) ──────────────────────────────────────

export interface PromotionBatchDetailDto extends PromotionBatchSummaryDto {
  entries: PromotionEntryDto[];
}

// ── Create batch result ───────────────────────────────────────────────────────

export interface CreateBatchResultDto {
  batch: PromotionBatchDetailDto;
}
