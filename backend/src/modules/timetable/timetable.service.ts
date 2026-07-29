import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { ConflictError, ForbiddenError, NotFoundError } from '../../core/errors/app-error';
import { CreateTimetableEntryInput, ListTimetableQuery } from './validation/timetable.validation';
import { TimetableEntryDto } from './dto/timetable.dto';

const ENTRY_INCLUDE = {
  teacherSubject: {
    include: { teacher: true, subject: true, classroom: true },
  },
} satisfies Prisma.TimetableEntryInclude;

type EntryWithRelations = Prisma.TimetableEntryGetPayload<{ include: typeof ENTRY_INCLUDE }>;

function toDto(e: EntryWithRelations): TimetableEntryDto {
  return {
    timetableEntryId: e.timetableEntryId,
    dayOfWeek: e.dayOfWeek,
    startTime: e.startTime,
    endTime: e.endTime,
    roomNumber: e.roomNumber,
    teacherSubject: {
      id: e.teacherSubject.id,
      teacher: {
        teacherId: e.teacherSubject.teacher.teacherId,
        firstName: e.teacherSubject.teacher.firstName,
        lastName: e.teacherSubject.teacher.lastName,
      },
      subject: {
        subjectId: e.teacherSubject.subject.subjectId,
        subjectCode: e.teacherSubject.subject.subjectCode,
        subjectName: e.teacherSubject.subject.subjectName,
      },
      classroom: {
        classroomId: e.teacherSubject.classroom.classroomId,
        className: e.teacherSubject.classroom.className,
        section: e.teacherSubject.classroom.section,
        academicYear: e.teacherSubject.classroom.academicYear,
      },
    },
  };
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function sortByDayThenTime(entries: TimetableEntryDto[]): TimetableEntryDto[] {
  return [...entries].sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
    return dayDiff !== 0 ? dayDiff : a.startTime.localeCompare(b.startTime);
  });
}

export class TimetableService {
  /**
   * Adds one weekly slot to a teaching assignment's schedule. Rejects the
   * slot if it would double-book the teacher or the classroom on that day.
   */
  async createEntry(input: CreateTimetableEntryInput): Promise<TimetableEntryDto> {
    const teacherSubject = await prisma.teacherSubject.findUnique({ where: { id: input.teacherSubjectId } });
    if (!teacherSubject) throw new NotFoundError('Teaching assignment');

    const sameDayEntries = await prisma.timetableEntry.findMany({
      where: {
        dayOfWeek: input.dayOfWeek,
        teacherSubject: {
          OR: [{ teacherId: teacherSubject.teacherId }, { classroomId: teacherSubject.classroomId }],
        },
      },
      include: { teacherSubject: true },
    });

    const teacherConflict = sameDayEntries.find(
      (e) => e.teacherSubject.teacherId === teacherSubject.teacherId && timesOverlap(input.startTime, input.endTime, e.startTime, e.endTime)
    );
    if (teacherConflict) {
      throw new ConflictError('This teacher already has a class scheduled that overlaps this time slot');
    }

    const classroomConflict = sameDayEntries.find(
      (e) => e.teacherSubject.classroomId === teacherSubject.classroomId && timesOverlap(input.startTime, input.endTime, e.startTime, e.endTime)
    );
    if (classroomConflict) {
      throw new ConflictError('This classroom already has a class scheduled that overlaps this time slot');
    }

    const created = await prisma.timetableEntry.create({ data: input, include: ENTRY_INCLUDE });
    return toDto(created);
  }

  async deleteEntry(id: number): Promise<void> {
    const entry = await prisma.timetableEntry.findUnique({ where: { timetableEntryId: id } });
    if (!entry) throw new NotFoundError('Timetable entry');
    await prisma.timetableEntry.delete({ where: { timetableEntryId: id } });
  }

  /** Oversight view: entries for a given classroom or teaching assignment. */
  async listEntries(query: ListTimetableQuery): Promise<TimetableEntryDto[]> {
    const where: Prisma.TimetableEntryWhereInput = {
      ...(query.teacherSubjectId && { teacherSubjectId: query.teacherSubjectId }),
      ...(query.classroomId && { teacherSubject: { classroomId: query.classroomId } }),
    };

    const entries = await prisma.timetableEntry.findMany({ where, include: ENTRY_INCLUDE });
    return sortByDayThenTime(entries.map(toDto));
  }

  /** Convenience: the logged-in teacher's own weekly schedule, across all their classes. */
  async listForTeacherUser(userId: number): Promise<TimetableEntryDto[]> {
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new ForbiddenError();

    const entries = await prisma.timetableEntry.findMany({
      where: { teacherSubject: { teacherId: teacher.teacherId } },
      include: ENTRY_INCLUDE,
    });
    return sortByDayThenTime(entries.map(toDto));
  }

  /** Convenience: the logged-in student's own classroom schedule. */
  async listForStudentUser(userId: number): Promise<TimetableEntryDto[]> {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new ForbiddenError();

    const entries = await prisma.timetableEntry.findMany({
      where: { teacherSubject: { classroomId: student.classroomId } },
      include: ENTRY_INCLUDE,
    });
    return sortByDayThenTime(entries.map(toDto));
  }
}

export const timetableService = new TimetableService();
