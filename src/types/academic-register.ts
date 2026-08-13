export type RegisterViewMode = 'SEMESTER_1' | 'SEMESTER_2' | 'FULL_YEAR';
export type AcademicStatus = 'PASS' | 'FAIL' | 'INCOMPLETE' | 'PENDING';

// ── Subject column definition ─────────────────────────────────────────────────

export interface RegisterSubjectColumn {
  subjectId:   number;
  subjectName: string;
  sortOrder:   number;
}

// ── Per-subject result ────────────────────────────────────────────────────────

export interface SubjectResult {
  subjectId:     number;
  subjectName:   string;
  finalResult:   number | null;   // /100 normalized, null = no data
  isFinalized:   boolean;
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
  totalObtained:   number | null;  // e.g. 655
  totalPossible:   number | null;  // e.g. 800 (subjects × 100)
  average:         number | null;  // /100
  sectionRank:     number | null;
  gradeRank:       number | null;
  totalStudentsInSection: number;
  totalStudentsInGrade:   number;
  conduct:         string | null;   // ConductRating enum value
  academicStatus:  AcademicStatus;
  hasUnfinalizedSubjects: boolean;
}

// ── Register metadata ─────────────────────────────────────────────────────────

export interface AcademicRegisterMetadata {
  classroomId:     number;
  classroomLabel:  string;
  academicYear:    string;
  viewMode:        RegisterViewMode;
  grade:           string;
  section:         string;
  totalStudents:   number;
  passCount:       number;
  failCount:       number;
  incompleteCount: number;
  pendingCount:    number;
  classAverage:    number | null;
  isOfficialView:  boolean;
  finalizedAt:     string | null;
  generatedAt:     string;
}

// ── Full register response ────────────────────────────────────────────────────

export interface AcademicRegisterResponse {
  metadata: AcademicRegisterMetadata;
  subjects: RegisterSubjectColumn[];
  students: AcademicRegisterStudent[];
}

// ── Grade-wide summary ────────────────────────────────────────────────────────

export interface GradeRegisterSummary {
  grade:          string;
  academicYear:   string;
  viewMode:       RegisterViewMode;
  totalSections:  number;
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

// ── Query params ──────────────────────────────────────────────────────────────

export interface AcademicRegisterQuery {
  classroomId:  number;
  academicYear: string;
  viewMode:     RegisterViewMode;
}

export interface GradeRegisterQuery {
  grade:        string;
  academicYear: string;
  viewMode:     RegisterViewMode;
}

export interface ExportRegisterQuery extends AcademicRegisterQuery {
  format: 'csv' | 'excel';
}
