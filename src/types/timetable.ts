import type { Semester } from './grade';

export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';

export interface TimetableEntry {
  timetableEntryId: number;
  semester: Semester;
  dayOfWeek: DayOfWeek;
  period: number;
  startTime: string;
  endTime: string;
  roomNumber: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  teacherSubject: {
    id: number;
    teacher: { teacherId: number; firstName: string; lastName: string };
    subject: { subjectId: number; subjectCode: string; subjectName: string };
    classroom: { classroomId: number; className: string; section: string; academicYear: string };
  };
}

export interface CreateTimetableEntryInput {
  teacherSubjectId: number;
  semester: Semester;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  roomNumber?: string;
}

export interface ListTimetableParams {
  classroomId?: number;
  teacherSubjectId?: number;
  semester?: Semester;
}
