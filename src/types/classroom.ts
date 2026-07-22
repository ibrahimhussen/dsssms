export interface ClassroomSummary {
  classroomId: number;
  className: string;
  section: string;
  academicYear: string;
  homeroomTeacher: { teacherId: number; firstName: string; lastName: string } | null;
  studentCount: number;
}
