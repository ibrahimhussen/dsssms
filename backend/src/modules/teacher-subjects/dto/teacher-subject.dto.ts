export interface TeacherSubjectAssignmentDto {
  id: number;
  teacher: { teacherId: number; firstName: string; lastName: string };
  subject: { subjectId: number; subjectCode: string; subjectName: string };
  classroom: { classroomId: number; className: string; section: string; academicYear: string };
}
