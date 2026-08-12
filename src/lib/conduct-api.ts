import { apiClient, unwrap } from './api-client';
import type { ApiResponse } from '../types/api';

export interface CreateConductInput {
  studentId: number;
  classroomId: number;
  academicYear: string;
  semester: 'SEMESTER_1' | 'SEMESTER_2';
  rating: 'EXCELLENT' | 'VERY_GOOD' | 'GOOD' | 'SATISFACTORY' | 'NEEDS_IMPROVEMENT';
  notes?: string;
}

export interface UpdateConductInput {
  rating?: 'EXCELLENT' | 'VERY_GOOD' | 'GOOD' | 'SATISFACTORY' | 'NEEDS_IMPROVEMENT';
  notes?: string;
}

export interface StudentConduct {
  id: number;
  studentId: number;
  studentName: string;
  classroomId: number;
  academicYear: string;
  semester: string;
  rating: string;
  notes?: string;
  assignedAt: string;
  assignedBy: {
    userId: number;
    firstName: string;
    lastName: string;
  };
}

export interface ClassroomConductSummary {
  classroomId: number;
  academicYear: string;
  semester: string;
  totalStudents: number;
  assignedCount: number;
  ratingDistribution: {
    EXCELLENT: number;
    VERY_GOOD: number;
    GOOD: number;
    SATISFACTORY: number;
    NEEDS_IMPROVEMENT: number;
  };
}

export const conductApi = {
  async upsertConduct(input: CreateConductInput): Promise<StudentConduct> {
    const response = await unwrap(apiClient.post<ApiResponse<StudentConduct>>('/conduct', input));
    return response;
  },

  async updateConduct(id: number, input: UpdateConductInput): Promise<StudentConduct> {
    const response = await unwrap(apiClient.put<ApiResponse<StudentConduct>>(`/conduct/${id}`, input));
    return response;
  },

  async getStudentConduct(
    studentId: number,
    classroomId: number,
    semester: string,
    academicYear: string
  ): Promise<StudentConduct> {
    const response = await unwrap(apiClient.get<ApiResponse<StudentConduct>>(
      `/conduct/student/${studentId}/${classroomId}/${semester}/${academicYear}`
    ));
    return response;
  },

  async getClassroomConducts(
    classroomId: number,
    semester: string,
    academicYear: string
  ): Promise<StudentConduct[]> {
    const response = await unwrap(apiClient.get<ApiResponse<StudentConduct[]>>(
      `/conduct/classroom/${classroomId}/${semester}/${academicYear}`
    ));
    return response;
  },

  async getClassroomConductSummary(
    classroomId: number,
    semester: string,
    academicYear: string
  ): Promise<ClassroomConductSummary> {
    const response = await unwrap(apiClient.get<ApiResponse<ClassroomConductSummary>>(
      `/conduct/classroom/${classroomId}/${semester}/${academicYear}/summary`
    ));
    return response;
  },

  async deleteConduct(id: number): Promise<void> {
    await unwrap(apiClient.delete<ApiResponse<void>>(`/conduct/${id}`));
  },
};
