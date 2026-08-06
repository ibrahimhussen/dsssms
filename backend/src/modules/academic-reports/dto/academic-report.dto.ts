import { Semester } from '@prisma/client';

export interface AcademicReportDto {
  reportId: number;
  studentId: number;
  studentName: string;
  semester: Semester;
  academicYear: string;
  averageMark: number;
  rank: number | null;
  generatedDate: string;
}

export interface TranscriptSubjectRowDto {
  subjectName: string;
  totalScore: number;
  totalMaxMarks: number;
  percentage: number;
}

export interface TranscriptPeriodDto {
  semester: Semester;
  academicYear: string;
  subjects: TranscriptSubjectRowDto[];
  periodAverage: number;
  rank: number | null;
}

export interface TranscriptDto {
  studentId: number;
  studentName: string;
  admissionNumber: string;
  gender: string;
  dateOfBirth: string;
  classroomLabel: string;
  enrolledAt: string;
  periods: TranscriptPeriodDto[];
  cumulativeAverage: number | null;
  generatedDate: string;
}
