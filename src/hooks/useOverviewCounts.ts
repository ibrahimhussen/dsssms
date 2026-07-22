import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '../lib/students-api';
import { usersApi } from '../lib/users-api';
import { classroomsApi } from '../lib/classrooms-api';

export function useOverviewCounts() {
  return useQuery({
    queryKey: ['overview-counts'],
    queryFn: async () => {
      const [students, teachers, classrooms] = await Promise.all([
        studentsApi.list({ limit: 1 }),
        usersApi.list({ role: 'TEACHER', limit: 1 }),
        classroomsApi.list({ limit: 1 }),
      ]);

      return {
        studentCount: students.meta.totalItems,
        teacherCount: teachers.meta.totalItems,
        classroomCount: classrooms.meta.totalItems,
      };
    },
  });
}
