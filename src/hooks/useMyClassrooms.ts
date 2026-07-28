import { useMemo } from 'react';
import { useMyTeachingAssignments } from './useDashboardData';
import { useClassroomOptions } from './useClassrooms';

export interface MyClassroomSubject {
  subjectId: number;
  subjectCode: string;
  subjectName: string;
}

export interface MyClassroomGroup {
  classroomId: number;
  className: string;
  section: string;
  academicYear: string;
  studentCount: number;
  homeroomTeacher: { teacherId: number; firstName: string; lastName: string } | null;
  subjects: MyClassroomSubject[];
}

/**
 * Groups the logged-in teacher's assignments by classroom (a teacher may
 * teach several subjects in the same classroom) and merges in each
 * classroom's enrolled-student count. Powers the teacher dashboard's
 * summary cards and the "My Classes" roster page.
 */
export function useMyClassrooms() {
  const assignments = useMyTeachingAssignments();
  const classrooms = useClassroomOptions();

  const data = useMemo<MyClassroomGroup[] | undefined>(() => {
    if (!assignments.data) return undefined;

    const byClassroom = new Map<number, MyClassroomGroup>();
    for (const a of assignments.data) {
      const existing = byClassroom.get(a.classroom.classroomId);
      const subject: MyClassroomSubject = {
        subjectId: a.subject.subjectId,
        subjectCode: a.subject.subjectCode,
        subjectName: a.subject.subjectName,
      };

      if (existing) {
        existing.subjects.push(subject);
      } else {
        const classroomInfo = classrooms.data?.items.find((c) => c.classroomId === a.classroom.classroomId);
        byClassroom.set(a.classroom.classroomId, {
          classroomId: a.classroom.classroomId,
          className: a.classroom.className,
          section: a.classroom.section,
          academicYear: a.classroom.academicYear,
          studentCount: classroomInfo?.studentCount ?? 0,
          homeroomTeacher: classroomInfo?.homeroomTeacher ?? null,
          subjects: [subject],
        });
      }
    }

    return [...byClassroom.values()].sort((a, b) => a.className.localeCompare(b.className));
  }, [assignments.data, classrooms.data]);

  return {
    data,
    isLoading: assignments.isLoading || classrooms.isLoading,
  };
}
