import type { PaginationParams } from './pagination';

export type Semester = 'FIRST' | 'SECOND';

export interface GradeRecord {
  gradeId: number;
  studentId: number;
  studentName: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  score: number;
  letterGrade: string;
  semester: Semester;
  academicYear: string;
  recordedBy: { teacherId: number; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface BulkGradeResult {
  classroomId: number;
  subjectId: number;
  semester: Semester;
  academicYear: string;
  recordsSaved: number;
}

export interface BulkRecordGradesInput {
  classroomId: number;
  subjectId: number;
  semester: Semester;
  academicYear: string;
  records: { studentId: number; score: number }[];
}

export interface UpdateGradeInput {
  score: number;
}

export interface ClassroomGradesParams {
  classroomId: number;
  subjectId: number;
  semester: Semester;
  academicYear: string;
}

export interface StudentGradesParams extends PaginationParams {
  semester?: Semester;
  academicYear?: string;
}
