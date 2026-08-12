import { ConductRating, Semester } from '@prisma/client';

export interface StudentConductDto {
  id: number;
  studentId: number;
  classroomId: number;
  academicYear: string;
  semester: Semester;
  rating: ConductRating;
  assignedBy: number;
  assignedAt: string;
  notes: string | null;
  updatedAt: string;
}

export interface StudentConductDetailDto extends StudentConductDto {
  studentName: string;
  admissionNumber: string;
  classroomLabel: string;
  assignedByName: string;
}

export interface CreateConductInput {
  studentId: number;
  classroomId: number;
  academicYear: string;
  semester: Semester;
  rating: ConductRating;
  notes?: string;
}

export interface UpdateConductInput {
  rating?: ConductRating;
  notes?: string;
}

export interface ClassroomConductSummaryDto {
  classroomId: number;
  classroomLabel: string;
  academicYear: string;
  semester: Semester;
  totalStudents: number;
  ratedStudents: number;
  ratingDistribution: {
    EXCELLENT: number;
    VERY_GOOD: number;
    GOOD: number;
    SATISFACTORY: number;
    NEEDS_IMPROVEMENT: number;
  };
}