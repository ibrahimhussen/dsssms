export interface ClassroomHomeroomTeacherSummary {
  teacherId: number;
  firstName: string;
  lastName: string;
}

export interface ClassroomSummaryDto {
  classroomId: number;
  className: string;
  section: string;
  academicYear: string;
  homeroomTeacher: ClassroomHomeroomTeacherSummary | null;
  studentCount: number;
}
