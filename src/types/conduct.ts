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
