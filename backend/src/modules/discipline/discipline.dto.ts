import type { DisciplineSeverity, DisciplineStatus } from '@prisma/client';

// Re-export so routes/controllers can import from one place
export type { DisciplineSeverity, DisciplineStatus };

export interface DisciplineRecordDto {
  id:              number;
  studentId:       number;
  studentName:     string;
  admissionNumber: string;
  className:       string;
  incidentDate:    string;
  title:           string;
  description:     string;
  severity:        DisciplineSeverity;
  status:          DisciplineStatus;
  reportedBy:      string;
  actionTaken?:    string;
  createdAt:       string;
}

export interface CreateDisciplineRecordInput {
  studentId:    number;
  incidentDate?: string;
  title:        string;
  description:  string;
  severity:     DisciplineSeverity;
  actionTaken?: string;
}

export interface UpdateDisciplineRecordInput {
  status?:      DisciplineStatus;
  actionTaken?: string;
  description?: string;
  severity?:    DisciplineSeverity;
}
