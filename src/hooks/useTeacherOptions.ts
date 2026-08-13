import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../lib/users-api';

/** Teachers for use in select dropdowns (assignment forms, homeroom teacher pickers).
 *  Calls the scoped /users/teachers endpoint — accessible to DIRECTOR and VICE_DIRECTOR,
 *  not just ADMIN.
 */
export function useTeacherOptions() {
  return useQuery({
    queryKey: ['users', 'teacher-options'],
    queryFn: async () => {
      const items = await usersApi.listTeachers();
      // Wrap in the same shape callers expect from paginated queries
      return { items };
    },
    staleTime: 60_000,
  });
}
