import type { Semester } from './grade';

export interface AcademicReport {
  reportId: number;
  studentId: number;
  studentName: string;
  semester: Semester;
  academicYear: string;
  averageMark: number;
  rank: number | null;
  generatedDate: string;
}

export interface GenerateClassroomReportsInput {
  classroomId: number;
  semester: Semester;
  academicYear: string;
}

export interface GenerateReportsResult {
  generated: AcademicReport[];
  skippedStudentIds: number[];
}
