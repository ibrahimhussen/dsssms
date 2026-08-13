export interface GradeSubjectConfig {
  id: number;
  className: string;
  academicYear: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  sortOrder: number;
  createdAt: string;
}

export interface ConfiguredGrade {
  className: string;
  academicYear: string;
  subjectCount: number;
}

export interface UpsertGradeSubjectConfigInput {
  className: string;
  academicYear: string;
  subjectId: number;
  sortOrder?: number;
}

export interface CopyFromYearInput {
  className: string;
  sourceAcademicYear: string;
  targetAcademicYear: string;
}

export interface CopyFromYearResult {
  created: number;
  skipped: number;
}
