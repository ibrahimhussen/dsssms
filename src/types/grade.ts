export type Semester = 'SEMESTER_1' | 'SEMESTER_2';

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

export interface BulkGradeRecordInput {
  studentId: number;
  score: number;
}

export interface BulkRecordGradesInput {
  classroomId: number;
  subjectId: number;
  semester: Semester;
  academicYear: string;
  records: BulkGradeRecordInput[];
}

export interface ClassroomGradesQuery {
  classroomId: number;
  subjectId: number;
  semester: Semester;
  academicYear: string;
}

export interface StudentGradesParams {
  page?: number;
  limit?: number;
  semester?: Semester;
  academicYear?: string;
}
