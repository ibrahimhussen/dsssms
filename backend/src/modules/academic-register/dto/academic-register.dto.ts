import { ConductRating, Semester } from '@prisma/client';

// ── View mode ─────────────────────────────────────────────────────────────────

export type RegisterViewMode = 'SEMESTER_1' | 'SEMESTER_2' | 'FULL_YEAR';

// ── Academic status ───────────────────────────────────────────────────────────

export enum AcademicStatus {
  PASS       = 'PASS',       // Finalized, meets all pass criteria
  FAIL       = 'FAIL',       // Finalized, below one or more thresholds
  INCOMPLETE = 'INCOMPLETE', // Some finalized, some missing
  PENDING    = 'PENDING',    // Not yet finalized — draft view
}

// ── Per-subject result row ────────────────────────────────────────────────────

export interface SubjectResult {
  subjectId:   number;
  subjectName: string;
  /** Normalized final result /100 — null means no data entered */
  finalResult:   number | null;
  /** Whether the subject finalization is FINALIZED for this period */
  isFinalized:   boolean;
  /** True when a teacher is assigned; false means no one is teaching this subject */
  hasAssignment: boolean;
}

// ── Per-student row ───────────────────────────────────────────────────────────

export interface AcademicRegisterStudent {
  studentId:       number;
  studentName:     string;
  admissionNumber: string;
  gender:          'M' | 'F';
  age:             number;
  subjectResults:  SubjectResult[];
  totalObtained:   number | null;  // sum of normalized results (e.g. 655)
  totalPossible:   number | null;  // configured subjects × 100 (e.g. 800)
  average:         number | null;  // totalObtained / (configuredSubjectCount) — /100
  sectionRank:     number | null;
  gradeRank:       number | null;
  totalStudentsInSection: number;
  totalStudentsInGrade:   number;
  conduct:         ConductRating | null;
  academicStatus:  AcademicStatus;
  /** Whether at least one subject is unfinalized (affects display warning) */
  hasUnfinalizedSubjects: boolean;
}

// ── Register metadata ─────────────────────────────────────────────────────────

export interface AcademicRegisterMetadata {
  classroomId:    number;
  classroomLabel: string;
  academicYear:   string;
  viewMode:       RegisterViewMode;
  grade:          string;
  section:        string;
  totalStudents:  number;
  passCount:      number;
  failCount:      number;
  incompleteCount: number;
  pendingCount:    number;
  classAverage:    number | null;
  isOfficialView:  boolean;  // true only when classroom is fully finalized
  finalizedAt:     string | null;
  generatedAt:     string;
}

// ── Full register response ────────────────────────────────────────────────────

export interface AcademicRegister {
  metadata: AcademicRegisterMetadata;
  subjects: { subjectId: number; subjectName: string; sortOrder: number }[];  // ordered column list
  students: AcademicRegisterStudent[];
}

// ── Query ─────────────────────────────────────────────────────────────────────

export interface AcademicRegisterQuery {
  classroomId?:  number;
  academicYear:  string;
  viewMode:      RegisterViewMode;
}

// ── Grade-wide summary ────────────────────────────────────────────────────────

export interface AcademicRegisterGradeSummary {
  grade:        string;
  academicYear: string;
  viewMode:     RegisterViewMode;
  totalSections: number;
  totalStudents:  number;
  overallAverage: number | null;
  overallPassRate: number | null;
  sections: {
    section:       string;
    classroomId:   number;
    studentCount:  number;
    passCount:     number;
    failCount:     number;
    sectionAverage: number | null;
  }[];
}
