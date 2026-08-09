export interface ClassroomHomeroomTeacherSummary {
  teacherId: number;
  firstName: string;
  lastName: string;
}

export type ClassSessionDto = 'MORNING' | 'AFTERNOON';

export interface ClassroomSummaryDto {
  classroomId: number;
  className: string;
  section: string;
  academicYear: string;
  session: ClassSessionDto;
  homeroomTeacher: ClassroomHomeroomTeacherSummary | null;
  studentCount: number;
}
