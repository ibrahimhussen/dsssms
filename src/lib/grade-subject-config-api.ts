import { apiClient, unwrap } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type {
  ConfiguredGrade,
  CopyFromYearInput,
  CopyFromYearResult,
  GradeSubjectConfig,
  UpsertGradeSubjectConfigInput,
} from '../types/grade-subject-config';

export const gradeSubjectConfigApi = {
  /** All (className, academicYear) pairs that have at least one subject configured */
  listConfiguredGrades(): Promise<ConfiguredGrade[]> {
    return unwrap(
      apiClient.get<ApiResponse<ConfiguredGrade[]>>('/grade-subject-config/configured-grades')
    );
  },

  /** All subjects configured for a specific grade + academic year */
  listForGrade(className: string, academicYear: string): Promise<GradeSubjectConfig[]> {
    return unwrap(
      apiClient.get<ApiResponse<GradeSubjectConfig[]>>('/grade-subject-config', {
        params: cleanParams({ className, academicYear }),
      })
    );
  },

  /** Add/update a subject in a grade's config */
  upsert(input: UpsertGradeSubjectConfigInput): Promise<GradeSubjectConfig> {
    return unwrap(
      apiClient.post<ApiResponse<GradeSubjectConfig>>('/grade-subject-config', input)
    );
  },

  /** Remove a subject from a grade's config */
  remove(id: number): Promise<null> {
    return unwrap(apiClient.delete<ApiResponse<null>>(`/grade-subject-config/${id}`));
  },

  /** Copy an entire year's config to a new academic year */
  copyFromYear(input: CopyFromYearInput): Promise<CopyFromYearResult> {
    return unwrap(
      apiClient.post<ApiResponse<CopyFromYearResult>>('/grade-subject-config/copy', input)
    );
  },
};
