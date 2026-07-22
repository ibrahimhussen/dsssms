import { useQuery } from '@tanstack/react-query';
import { classroomsApi } from '../lib/classrooms-api';

export function useClassroomOptions() {
  return useQuery({
    queryKey: ['classrooms', 'options'],
    queryFn: () => classroomsApi.list({ limit: 100 }),
    staleTime: 60_000,
  });
}
