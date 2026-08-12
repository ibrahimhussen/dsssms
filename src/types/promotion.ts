import type { PaginationParams } from './pagination';

export type EnrollmentDecision =
  | 'ACTIVE'
  | 'PROMOTED'
  | 'REPEATED'
  | 'GRADUATED'
  | 'TRANSFERRED_OUT'
  | 'CORRECTED'
  | 'REVERSED';

export type EligibilityStatus = 'ELIGIBLE' | 'PENDING_REVIEW' | 'NOT_ELIGIBLE';
export type PromotionDecision = 'PROMOTED' | 'REPEATED' | 'GRADUATED';
export type BatchStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

// ── Enrollment history ────────────────────────────────────────────────────────

export interface StudentEnrollmentRecord {
  id: number;
  studentId: number;
  classroomId: number;
  classroomLabel: string;
  academicYear: string;
  decision: EnrollmentDecision;
  batchId: number | null;
  notes: string | null;
  createdAt: string;
}

// ── Promotion entry ───────────────────────────────────────────────────────────

export interface PromotionEntry {
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

export interface PromotionBatchSummary {
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

export interface PromotionBatchDetail extends PromotionBatchSummary {
  entries: PromotionEntry[];
}

// ── Create batch ──────────────────────────────────────────────────────────────

export interface CreateBatchInput {
  sourceClassroomId: number;
  targetAcademicYear: string;
}

export interface CreateBatchResult {
  batch: PromotionBatchDetail;
}

// ── Update entry ──────────────────────────────────────────────────────────────

export interface UpdateEntryInput {
  decision?: PromotionDecision;
  targetClassroomId?: number | null;
  overrideReason?: string | null;
}

// ── Bulk assign classroom ─────────────────────────────────────────────────────

export interface BulkAssignClassroomInput {
  targetClassroomId: number;
  onlyDecision?: PromotionDecision;
}

// ── Reject ────────────────────────────────────────────────────────────────────

export interface RejectBatchInput {
  rejectionReason: string;
}

// ── Correct ───────────────────────────────────────────────────────────────────

export interface CorrectEntryInput {
  targetClassroomId: number;
  notes?: string;
}

// ── List params ───────────────────────────────────────────────────────────────

export interface ListBatchesParams extends PaginationParams {
  status?: BatchStatus;
  sourceClassroomId?: number;
}
