import { ConductRating, Semester } from '@prisma/client';

export enum AcademicStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  INCOMPLETE = 'INCOMPLETE',
  PENDING = 'PENDING',
}

export interface SubjectResult {
  subjectId: number;
  subjectName: string;
  finalResult: number | null; // /100
  isComplete: boolean;
}

export interface AcademicRegisterStudent {
  studentId: number;
  studentName: string;
  admissionNumber: string;
  gender: 'M' | 'F';
  age: number;
  subjectResults: SubjectResult[];
  totalObtained: number | null;
  totalPossible: number | null;
  average: number | null;
  sectionRank: number | null;
  gradeRank: number | null;
  conduct: ConductRating | null;
  academicStatus: AcademicStatus;
}

export interface AcademicRegisterMetadata {
  classroomId: number;
  classroomLabel: string;
  academicYear: string;
  semester: Semester;
  grade: string;
  section: string;
  totalStudents: number;
  eligibleStudents: number;
  incompleteStudents: number;
  finalizedAt: string | null;
  generatedAt: string;
}

export interface AcademicRegister {
  metadata: AcademicRegisterMetadata;
  students: AcademicRegisterStudent[];
}

export interface AcademicRegisterQuery {
  classroomId?: number;
  grade?: string;
  academicYear: string;
  semester: Semester;
  section?: string;
  gradeWide?: boolean;
  page?: number;
  limit?: number;
}

export interface AcademicRegisterSummary {
  grade: string;
  academicYear: string;
  semester: Semester;
  totalSections: number;
  totalStudents: number;
  averageGradeAverage: number;
  passRate: number;
  sections: {
    section: string;
    classroomId: number;
    studentCount: number;
    averageScore: number;
    passRate: number;
  }[];
}