import { apiClient, unwrap } from './api-client';
import type { ApiResponse } from '../types/api';

export interface SubmitForReviewInput {
  teacherSubjectId: number;
  semester: 'SEMESTER_1' | 'SEMESTER_2';
  academicYear: string;
}

export interface ReviewSubjectInput {
  teacherSubjectId: number;
  semester: 'SEMESTER_1' | 'SEMESTER_2';
  academicYear: string;
  approved: boolean;
  reviewNotes?: string;
}

export interface FinalizeSubjectInput {
  teacherSubjectId: number;
  semester: 'SEMESTER_1' | 'SEMESTER_2';
  academicYear: string;
}

export interface FinalizeClassroomInput {
  classroomId: number;
  semester: 'SEMESTER_1' | 'SEMESTER_2';
  academicYear: string;
}

export interface CorrectFinalizationInput {
  correctionReason: string;
}

export interface SubjectFinalization {
  id: number;
  teacherSubjectId: number;
  semester: string;
  academicYear: string;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'FINALIZED';
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: {
    userId: number;
    firstName: string;
    lastName: string;
  };
  finalizedAt?: string;
  finalizedBy?: {
    userId: number;
    firstName: string;
    lastName: string;
  };
  reviewNotes?: string;
  studentCount: number;
  missingResultsCount: number;
}

export interface ClassroomFinalization {
  id: number;
  classroomId: number;
  semester: string;
  academicYear: string;
  status: 'PENDING' | 'FINALIZED';
  finalizedAt?: string;
  finalizedBy?: {
    userId: number;
    firstName: string;
    lastName: string;
  };
  subjectFinalizations: SubjectFinalization[];
  allSubjectsFinalized: boolean;
}

export const finalizationApi = {
  async submitForReview(input: SubmitForReviewInput): Promise<SubjectFinalization> {
    const response = await unwrap(apiClient.post<ApiResponse<SubjectFinalization>>('/finalization/submit-for-review', input));
    return response;
  },

  async reviewSubject(input: ReviewSubjectInput): Promise<SubjectFinalization> {
    const response = await unwrap(apiClient.post<ApiResponse<SubjectFinalization>>('/finalization/review-subject', input));
    return response;
  },

  async finalizeSubject(input: FinalizeSubjectInput): Promise<SubjectFinalization> {
    const response = await unwrap(apiClient.post<ApiResponse<SubjectFinalization>>('/finalization/finalize-subject', input));
    return response;
  },

  async finalizeClassroom(input: FinalizeClassroomInput): Promise<ClassroomFinalization> {
    const response = await unwrap(apiClient.post<ApiResponse<ClassroomFinalization>>('/finalization/finalize-classroom', input));
    return response;
  },

  async getSubjectFinalization(
    teacherSubjectId: number,
    semester: string,
    academicYear: string
  ): Promise<SubjectFinalization> {
    const response = await unwrap(apiClient.get<ApiResponse<SubjectFinalization>>(
      `/finalization/subject/${teacherSubjectId}/${semester}`,
      { params: { academicYear } }
    ));
    return response;
  },

  async getClassroomFinalization(
    classroomId: number,
    semester: string,
    academicYear: string
  ): Promise<ClassroomFinalization> {
    const response = await unwrap(apiClient.get<ApiResponse<ClassroomFinalization>>(
      `/finalization/classroom/${classroomId}/${semester}`,
      { params: { academicYear } }
    ));
    return response;
  },

  async getClassroomSubjectFinalizations(
    classroomId: number,
    semester: string,
    academicYear: string
  ): Promise<SubjectFinalization[]> {
    const response = await unwrap(apiClient.get<ApiResponse<SubjectFinalization[]>>(
      `/finalization/classroom/${classroomId}/${semester}/subjects`,
      { params: { academicYear } }
    ));
    return response;
  },

  async correctSubjectFinalization(
    id: number,
    input: CorrectFinalizationInput
  ): Promise<SubjectFinalization> {
    const response = await unwrap(apiClient.post<ApiResponse<SubjectFinalization>>(`/finalization/subject/${id}/correct`, input));
    return response;
  },

  async correctClassroomFinalization(
    id: number,
    input: CorrectFinalizationInput
  ): Promise<ClassroomFinalization> {
    const response = await unwrap(apiClient.post<ApiResponse<ClassroomFinalization>>(`/finalization/classroom/${id}/correct`, input));
    return response;
  },
};
