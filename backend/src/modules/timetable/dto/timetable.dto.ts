import { DayOfWeek, Semester } from '@prisma/client';

export interface TimetableEntryDto {
  timetableEntryId: number;
  semester: Semester;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  roomNumber: string | null;
  teacherSubject: {
    id: number;
    teacher: { teacherId: number; firstName: string; lastName: string };
    subject: { subjectId: number; subjectCode: string; subjectName: string };
    classroom: { classroomId: number; className: string; section: string; academicYear: string };
  };
}
