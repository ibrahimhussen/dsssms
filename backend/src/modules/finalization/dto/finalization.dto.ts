import { FinalizationStatus, Semester } from '@prisma/client';

export interface SubjectFinalizationDto {
  id: number;
  teacherSubjectId: number;
  semester: Semester;
  academicYear: string;
  status: FinalizationStatus;
  reviewedBy: number | null;
  reviewedAt: string | null;
  reviewedByUser?: {
    userId: number;
    firstName: string;
    lastName: string;
  };
  finalizedBy: number | null;
  finalizedAt: string | null;
  finalizedByUser?: {
    userId: number;
    firstName: string;
    lastName: string;
  };
  correctionReason: string | null;
  lastCorrectionAt: string | null;
  createdAt: string;
  updatedAt: string;
  studentCount: number;
  missingResultsCount: number;
}

export interface ClassroomFinalizationDto {
  id: number;
  classroomId: number;
  semester: Semester;
  academicYear: string;
  status: FinalizationStatus;
  finalizedBy: number | null;
  finalizedAt: string | null;
  correctionReason: string | null;
  lastCorrectionAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectFinalizationSummaryDto {
  id: number;
  teacherSubjectId: number;
  subjectName: string;
  teacherName: string;
  classroomLabel: string;
  semester: Semester;
  academicYear: string;
  status: FinalizationStatus;
  studentCount: number;
  completedStudentCount: number;
}

export interface SubmitForReviewInput {
  teacherSubjectId: number;
  semester: Semester;
  academicYear: string;
}

export interface ReviewSubjectInput {
  teacherSubjectId: number;
  semester: Semester;
  academicYear: string;
  approved: boolean;
  reviewNotes?: string;
}

export interface FinalizeSubjectInput {
  teacherSubjectId: number;
  semester: Semester;
  academicYear: string;
}

export interface FinalizeClassroomInput {
  classroomId: number;
  semester: Semester;
  academicYear: string;
}

export interface CorrectFinalizationInput {
  correctionReason: string;
}