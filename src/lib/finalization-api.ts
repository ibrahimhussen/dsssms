import { apiClient, unwrap } from './api-client';
import type { ApiResponse } from '../types/api';
import type {
  ClassroomFinalization,
  CorrectFinalizationInput,
  FinalizeClassroomInput,
  FinalizeSubjectInput,
  ReviewSubjectInput,
  SubjectFinalization,
  SubmitForReviewInput,
} from '../types/finalization';

export type {
  SubmitForReviewInput,
  ReviewSubjectInput,
  FinalizeSubjectInput,
  FinalizeClassroomInput,
  CorrectFinalizationInput,
  SubjectFinalization,
  ClassroomFinalization,
};

export const finalizationApi = {
  async submitForReview(input: SubmitForReviewInput): Promise<SubjectFinalization> {
    return unwrap(apiClient.post<ApiResponse<SubjectFinalization>>('/finalization/submit-for-review', input));
  },

  async reviewSubject(input: ReviewSubjectInput): Promise<SubjectFinalization> {
    return unwrap(apiClient.post<ApiResponse<SubjectFinalization>>('/finalization/review-subject', input));
  },

  async finalizeSubject(input: FinalizeSubjectInput): Promise<SubjectFinalization> {
    return unwrap(apiClient.post<ApiResponse<SubjectFinalization>>('/finalization/finalize-subject', input));
  },

  async finalizeClassroom(input: FinalizeClassroomInput): Promise<ClassroomFinalization> {
    return unwrap(apiClient.post<ApiResponse<ClassroomFinalization>>('/finalization/finalize-classroom', input));
  },

  async getSubjectFinalization(
    teacherSubjectId: number,
    semester: string,
    academicYear: string
  ): Promise<SubjectFinalization> {
    return unwrap(apiClient.get<ApiResponse<SubjectFinalization>>(
      `/finalization/subject/${teacherSubjectId}/${semester}`,
      { params: { academicYear } }
    ));
  },

  async getClassroomFinalization(
    classroomId: number,
    semester: string,
    academicYear: string
  ): Promise<ClassroomFinalization> {
    return unwrap(apiClient.get<ApiResponse<ClassroomFinalization>>(
      `/finalization/classroom/${classroomId}/${semester}`,
      { params: { academicYear } }
    ));
  },

  async getClassroomSubjectFinalizations(
    classroomId: number,
    semester: string,
    academicYear: string
  ): Promise<SubjectFinalization[]> {
    return unwrap(apiClient.get<ApiResponse<SubjectFinalization[]>>(
      `/finalization/classroom/${classroomId}/${semester}/subjects`,
      { params: { academicYear } }
    ));
  },

  async correctSubjectFinalization(
    id: number,
    input: CorrectFinalizationInput
  ): Promise<SubjectFinalization> {
    return unwrap(apiClient.post<ApiResponse<SubjectFinalization>>(`/finalization/subject/${id}/correct`, input));
  },

  async correctClassroomFinalization(
    id: number,
    input: CorrectFinalizationInput
  ): Promise<ClassroomFinalization> {
    return unwrap(apiClient.post<ApiResponse<ClassroomFinalization>>(`/finalization/classroom/${id}/correct`, input));
  },
};
