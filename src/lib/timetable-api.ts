import { apiClient, unwrap } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type { CreateTimetableEntryInput, ListTimetableParams, TimetableEntry } from '../types/timetable';

export const timetableApi = {
  getMyTimetable() {
    return unwrap(apiClient.get<ApiResponse<TimetableEntry[]>>('/timetable/me'));
  },

  list(params: ListTimetableParams) {
    return unwrap(apiClient.get<ApiResponse<TimetableEntry[]>>('/timetable', { params: cleanParams(params) }));
  },

  create(input: CreateTimetableEntryInput) {
    return unwrap(apiClient.post<ApiResponse<TimetableEntry>>('/timetable', input));
  },

  delete(timetableEntryId: number) {
    return unwrap(apiClient.delete<ApiResponse<null>>(`/timetable/${timetableEntryId}`));
  },
};
