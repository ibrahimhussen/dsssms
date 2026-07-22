import type { PaginationParams } from './pagination';

export interface TeacherSubjectAssignment {
  id: number;
  teacher: { teacherId: number; firstName: string; lastName: string };
  subject: { subjectId: number; subjectCode: string; subjectName: string };
  classroom: { classroomId: number; className: string; section: string; academicYear: string };
}

export interface CreateAssignmentInput {
  teacherId: number;
  subjectId: number;
  classroomId: number;
}

export interface ListAssignmentsParams extends PaginationParams {
  teacherId?: number;
  classroomId?: number;
  subjectId?: number;
}
