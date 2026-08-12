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
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'FINALIZED' | 'DRAFT' | 'UNDER_REVIEW';
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
