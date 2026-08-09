import { apiClient, unwrap } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';

export type DisciplineSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DisciplineStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export interface DisciplineRecord {
  id: number;
  studentId: number;
  studentName: string;
  admissionNumber: string;
  className: string;
  incidentDate: string;
  title: string;
  description: string;
  severity: DisciplineSeverity;
  status: DisciplineStatus;
  reportedBy: string;
  actionTaken?: string;
  createdAt: string;
}

export interface CreateDisciplineRecordInput {
  studentId: number;
  incidentDate?: string;
  title: string;
  description: string;
  severity: DisciplineSeverity;
  actionTaken?: string;
}

export interface UpdateDisciplineRecordInput {
  status?: DisciplineStatus;
  actionTaken?: string;
  description?: string;
  severity?: DisciplineSeverity;
}

export const disciplineApi = {
  list(params?: { studentId?: number; severity?: DisciplineSeverity; status?: DisciplineStatus; search?: string }) {
    return unwrap(
      apiClient.get<ApiResponse<DisciplineRecord[]>>('/discipline-records', { params: cleanParams(params || {}) })
    );
  },

  create(input: CreateDisciplineRecordInput) {
    return unwrap(apiClient.post<ApiResponse<DisciplineRecord>>('/discipline-records', input));
  },

  update(id: number, input: UpdateDisciplineRecordInput) {
    return unwrap(apiClient.patch<ApiResponse<DisciplineRecord>>(`/discipline-records/${id}`, input));
  },
};
