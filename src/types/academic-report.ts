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
  className: string;
  section: string;
  subjects: TranscriptSubjectRow[];
  totalObtained: number;
  totalMaxMarks: number;
  periodAverage: number;
  rank: number | null;
  academicStatus: 'PASS' | 'FAIL' | 'PENDING';
  promotionDecision: 'PROMOTED' | 'REPEATED' | 'GRADUATED' | null;
}

export interface Transcript {
  studentId: number;
  studentName: string;
  admissionNumber: string;
  gender: string;
  dateOfBirth: string;
  classroomLabel: string;
  enrolledAt: string;
  dateOfLeavingAt: string | null;
  schoolName: string;
  periods: TranscriptPeriod[];
  cumulativeAverage: number | null;
  generatedDate: string;
}
