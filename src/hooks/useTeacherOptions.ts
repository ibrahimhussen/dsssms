import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../lib/users-api';

/** Teachers for use in select dropdowns (assignment forms, homeroom teacher pickers). */
export function useTeacherOptions() {
  return useQuery({
    queryKey: ['users', 'teacher-options'],
    queryFn: () => usersApi.list({ role: 'TEACHER', status: 'ACTIVE', limit: 100 }),
    staleTime: 60_000,
  });
}
