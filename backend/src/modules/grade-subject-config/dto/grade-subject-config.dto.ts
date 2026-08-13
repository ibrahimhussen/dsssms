export interface GradeSubjectConfigDto {
  id: number;
  className: string;
  academicYear: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  sortOrder: number;
  createdAt: string;
}

export interface UpsertGradeSubjectConfigInput {
  className: string;
  academicYear: string;
  subjectId: number;
  sortOrder?: number;
}

export interface CopyFromYearInput {
  sourceAcademicYear: string;
  targetAcademicYear: string;
  className: string;
}

export interface ListGradeSubjectConfigQuery {
  className: string;
  academicYear: string;
}
