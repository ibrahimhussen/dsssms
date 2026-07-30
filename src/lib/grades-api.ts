import { apiClient, unwrap } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type {
  ClassroomSubjectTotal,
  ComponentRoster,
  CreateGradeComponentInput,
  GradeComponent,
  GradeComponentQuery,
  GradeScheme,
  RecordComponentEntriesInput,
  StudentGradesParams,
  SubjectGradeBreakdown,
} from '../types/grade';

export const gradesApi = {
  createComponent(input: CreateGradeComponentInput) {
    return unwrap(apiClient.post<ApiResponse<GradeComponent>>('/grades/components', input));
  },

  deleteComponent(gradeComponentId: number) {
    return unwrap(apiClient.delete<ApiResponse<null>>(`/grades/components/${gradeComponentId}`));
  },

  listComponents(query: GradeComponentQuery) {
    return unwrap(apiClient.get<ApiResponse<GradeScheme>>('/grades/components', { params: query }));
  },

  recordComponentEntries(gradeComponentId: number, input: RecordComponentEntriesInput) {
    return unwrap(
      apiClient.post<ApiResponse<{ gradeComponentId: number; recordsSaved: number }>>(
        `/grades/components/${gradeComponentId}/entries`,
        input
      )
    );
  },

  getComponentRoster(gradeComponentId: number) {
    return unwrap(apiClient.get<ApiResponse<ComponentRoster>>(`/grades/components/${gradeComponentId}/entries`));
  },

  getClassroomTotals(query: GradeComponentQuery) {
    return unwrap(apiClient.get<ApiResponse<ClassroomSubjectTotal[]>>('/grades/classroom-totals', { params: query }));
  },

  getMyGrades(params: StudentGradesParams = {}) {
    return unwrap(apiClient.get<ApiResponse<SubjectGradeBreakdown[]>>('/grades/me', { params: cleanParams(params) }));
  },

  getStudentGrades(studentId: number, params: StudentGradesParams = {}) {
    return unwrap(
      apiClient.get<ApiResponse<SubjectGradeBreakdown[]>>(`/grades/student/${studentId}`, { params: cleanParams(params) })
    );
  },
};
