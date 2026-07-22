import type { PaginationParams } from './pagination';

export interface SubjectSummary {
  subjectId: number;
  subjectCode: string;
  subjectName: string;
}

export interface CreateSubjectInput {
  subjectCode: string;
  subjectName: string;
}

export interface ListSubjectsParams extends PaginationParams {
  search?: string;
}
