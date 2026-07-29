import { SubmissionStatus } from '@prisma/client';

export interface AssignmentTeacherSubjectSummary {
  id: number;
  teacher: { teacherId: number; firstName: string; lastName: string };
  subject: { subjectId: number; subjectCode: string; subjectName: string };
  classroom: { classroomId: number; className: string; section: string; academicYear: string };
}

export interface AssignmentDto {
  assignmentId: number;
  title: string;
  description: string | null;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  teacherSubject: AssignmentTeacherSubjectSummary;
}

export interface AssignmentWithSummaryDto extends AssignmentDto {
  submissionSummary: { total: number; submitted: number; late: number; notSubmitted: number };
}

export interface AssignmentSubmissionDto {
  submissionId: number;
  assignmentId: number;
  status: SubmissionStatus;
  submittedAt: string | null;
  notes: string | null;
  updatedAt: string;
  student: { studentId: number; firstName: string; lastName: string; admissionNumber: string };
}

export interface StudentAssignmentDto extends AssignmentDto {
  mySubmission: { status: SubmissionStatus; submittedAt: string | null; notes: string | null };
}
