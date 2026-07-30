import { GradeCategory, Semester } from '@prisma/client';

export interface GradeComponentDto {
  gradeComponentId: number;
  teacherSubjectId: number;
  semester: Semester;
  academicYear: string;
  category: GradeCategory;
  name: string;
  maxMarks: number;
}

export interface GradeSchemeDto {
  components: GradeComponentDto[];
  totalMaxMarks: number;
  remainingMarks: number;
  hasFinalExam: boolean;
}

export interface GradeEntryResultDto {
  gradeComponentId: number;
  recordsSaved: number;
}

export interface ComponentRosterEntryDto {
  studentId: number;
  studentName: string;
  score: number | null;
}

export interface ComponentRosterDto {
  component: GradeComponentDto;
  roster: ComponentRosterEntryDto[];
}

export interface ClassroomSubjectTotalDto {
  studentId: number;
  studentName: string;
  componentScores: { gradeComponentId: number; score: number | null }[];
  totalScore: number;
  totalMaxMarks: number;
}

export interface SubjectGradeComponentBreakdownDto {
  gradeComponentId: number;
  category: GradeCategory;
  name: string;
  maxMarks: number;
  score: number | null;
}

export interface SubjectGradeBreakdownDto {
  teacherSubjectId: number;
  subject: { subjectId: number; subjectCode: string; subjectName: string };
  teacher: { teacherId: number; firstName: string; lastName: string };
  semester: Semester;
  academicYear: string;
  components: SubjectGradeComponentBreakdownDto[];
  totalScore: number;
  totalMaxMarks: number;
}
