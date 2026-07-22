import { Semester } from '@prisma/client';

export interface GradeRecordDto {
  gradeId: number;
  studentId: number;
  studentName: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  score: number;
  letterGrade: string;
  semester: Semester;
  academicYear: string;
  recordedBy: { teacherId: number; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface BulkGradeResultDto {
  classroomId: number;
  subjectId: number;
  semester: Semester;
  academicYear: string;
  recordsSaved: number;
}
