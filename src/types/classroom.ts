import type { PaginationParams } from './pagination';

export interface ClassroomSummary {
  classroomId: number;
  className: string;
  section: string;
  academicYear: string;
  homeroomTeacher: { teacherId: number; firstName: string; lastName: string } | null;
  studentCount: number;
}

export interface CreateClassroomInput {
  className: string;
  section: string;
  academicYear: string;
  homeroomTeacherId?: number;
}

export interface ListClassroomsParams extends PaginationParams {
  academicYear?: string;
  search?: string;
}
