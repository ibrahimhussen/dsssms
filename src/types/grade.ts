export type Semester = 'SEMESTER_1' | 'SEMESTER_2';

export type GradeCategory = 'QUIZ' | 'ASSIGNMENT' | 'TEST' | 'MID_EXAM' | 'FINAL_EXAM' | 'OTHER';

export interface GradeComponent {
  gradeComponentId: number;
  teacherSubjectId: number;
  semester: Semester;
  academicYear: string;
  category: GradeCategory;
  name: string;
  maxMarks: number;
}

export interface GradeScheme {
  components: GradeComponent[];
  totalMaxMarks: number;
  remainingMarks: number;
  hasFinalExam: boolean;
}

export interface CreateGradeComponentInput {
  teacherSubjectId: number;
  semester: Semester;
  academicYear: string;
  category: GradeCategory;
  name: string;
  maxMarks: number;
}

export interface GradeComponentQuery {
  teacherSubjectId: number;
  semester: Semester;
  academicYear: string;
}

export interface ComponentRosterEntry {
  studentId: number;
  studentName: string;
  score: number | null;
}

export interface ComponentRoster {
  component: GradeComponent;
  roster: ComponentRosterEntry[];
}

export interface RecordComponentEntriesInput {
  records: { studentId: number; score: number }[];
}

export interface ClassroomSubjectTotal {
  studentId: number;
  studentName: string;
  componentScores: { gradeComponentId: number; score: number | null }[];
  totalScore: number;
  totalMaxMarks: number;
}

export interface SubjectGradeComponentBreakdown {
  gradeComponentId: number;
  category: GradeCategory;
  name: string;
  maxMarks: number;
  score: number | null;
}

export interface SubjectGradeBreakdown {
  teacherSubjectId: number;
  subject: { subjectId: number; subjectCode: string; subjectName: string };
  teacher: { teacherId: number; firstName: string; lastName: string };
  semester: Semester;
  academicYear: string;
  components: SubjectGradeComponentBreakdown[];
  totalScore: number;
  totalMaxMarks: number;
}

export interface StudentGradesParams {
  semester?: Semester;
  academicYear?: string;
}
