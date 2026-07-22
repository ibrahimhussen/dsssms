import { Semester } from '@prisma/client';

export interface AcademicReportDto {
  reportId: number;
  studentId: number;
  studentName: string;
  semester: Semester;
  academicYear: string;
  averageMark: number;
  rank: number | null;
  generatedDate: string;
}
