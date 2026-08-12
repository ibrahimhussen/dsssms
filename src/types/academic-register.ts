export interface AcademicRegisterQuery {
  classroomId?: number;
  grade?: string;
  section?: string;
  academicYear: string;
  semester: 'SEMESTER_1' | 'SEMESTER_2';
  gradeWide?: boolean;
  page?: number;
  limit?: number;
}

export interface AcademicRegisterStudent {
  studentId: number;
  studentName: string;
  sectionRank?: number;
  gradeRank?: number;
  total: number;
  average: number;
  academicStatus: 'PASS' | 'FAIL' | 'INCOMPLETE' | 'PENDING';
  subjectResults: Array<{
    subjectName: string;
    finalResult: number | null;
  }>;
  conduct?: string;
}

export interface AcademicRegisterMetadata {
  classroomLabel: string;
  academicYear: string;
  semester: string;
  totalStudents: number;
  passedCount: number;
  failedCount: number;
  incompleteCount: number;
  pendingCount: number;
  classAverage: number;
}

export interface AcademicRegisterResponse {
  metadata: AcademicRegisterMetadata;
  students: AcademicRegisterStudent[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GradeSummaryResponse {
  grade: string;
  academicYear: string;
  semester: string;
  totalStudents: number;
  passedCount: number;
  failedCount: number;
  incompleteCount: number;
  pendingCount: number;
  gradeAverage: number;
  sections: Array<{
    section: string;
    sectionAverage: number;
    studentCount: number;
  }>;
}
