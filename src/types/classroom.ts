import type { PaginationParams } from './pagination';

export type ClassSession = 'MORNING' | 'AFTERNOON';

export interface ClassroomSummary {
  classroomId: number;
  className: string;
  section: string;
  academicYear: string;
  session: ClassSession;
  homeroomTeacher: { teacherId: number; firstName: string; lastName: string } | null;
  studentCount: number;
}

export interface CreateClassroomInput {
  className: string;
  section: string;
  academicYear: string;
  session?: ClassSession;
  homeroomTeacherId?: number;
}

export interface ListClassroomsParams extends PaginationParams {
  academicYear?: string;
  search?: string;
}
