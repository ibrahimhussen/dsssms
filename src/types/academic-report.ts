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

export interface TranscriptSubjectRow {
  subjectName: string;
  totalScore: number;
  totalMaxMarks: number;
  percentage: number;
}

export interface TranscriptPeriod {
  semester: Semester;
  academicYear: string;
  subjects: TranscriptSubjectRow[];
  periodAverage: number;
  rank: number | null;
}

export interface Transcript {
  studentId: number;
  studentName: string;
  admissionNumber: string;
  gender: string;
  dateOfBirth: string;
  classroomLabel: string;
  enrolledAt: string;
  periods: TranscriptPeriod[];
  cumulativeAverage: number | null;
  generatedDate: string;
}
