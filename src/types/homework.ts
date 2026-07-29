export type HomeworkSubmissionStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'LATE';

interface HomeworkTeacherSubjectSummary {
  id: number;
  teacher: { teacherId: number; firstName: string; lastName: string };
  subject: { subjectId: number; subjectCode: string; subjectName: string };
  classroom: { classroomId: number; className: string; section: string; academicYear: string };
}

export interface HomeworkTask {
  assignmentId: number;
  title: string;
  description: string | null;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  teacherSubject: HomeworkTeacherSubjectSummary;
}

export interface TeacherHomeworkTask extends HomeworkTask {
  submissionSummary: { total: number; submitted: number; late: number; notSubmitted: number };
}

export interface StudentHomeworkTask extends HomeworkTask {
  mySubmission: { status: HomeworkSubmissionStatus; submittedAt: string | null; notes: string | null };
}

export interface HomeworkSubmission {
  submissionId: number;
  assignmentId: number;
  status: HomeworkSubmissionStatus;
  submittedAt: string | null;
  notes: string | null;
  updatedAt: string;
  student: { studentId: number; firstName: string; lastName: string; admissionNumber: string };
}

export interface CreateHomeworkInput {
  teacherSubjectId: number;
  title: string;
  description?: string;
  dueDate: string;
}

export interface UpdateHomeworkSubmissionStatusInput {
  status: HomeworkSubmissionStatus;
  notes?: string;
}

export interface MarkMyHomeworkSubmissionInput {
  submitted: boolean;
  notes?: string;
}
