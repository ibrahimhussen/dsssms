import { useQuery } from '@tanstack/react-query';
import { teacherSubjectsApi } from '../lib/teacher-subjects-api';
import { attendanceApi } from '../lib/attendance-api';
import { parentsApi } from '../lib/parents-api';

export function useMyTeachingAssignments() {
  return useQuery({
    queryKey: ['teacher-subjects', 'me'],
    queryFn: () => teacherSubjectsApi.getMyAssignments(),
  });
}

export function useMyAttendanceSummary() {
  return useQuery({
    queryKey: ['attendance', 'me', 'summary'],
    queryFn: () => attendanceApi.getMySummary(),
  });
}

export function useMyParentProfile() {
  return useQuery({
    queryKey: ['parents', 'me'],
    queryFn: () => parentsApi.getMyProfile(),
  });
}
