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

export interface TranscriptSubjectRowDto {
  subjectName: string;
  totalScore: number;
  totalMaxMarks: number;
  percentage: number;
}

export interface TranscriptPeriodDto {
  semester: Semester;
  academicYear: string;
  /** Grade the student was in during this period, e.g. "Grade 9" */
  className: string;
  /** Section during this period, e.g. "A" */
  section: string;
  subjects: TranscriptSubjectRowDto[];
  /** Sum of released subject scores for this period */
  totalObtained: number;
  /** Sum of max possible marks for released subjects */
  totalMaxMarks: number;
  periodAverage: number;
  rank: number | null;
  /** Official academic status: PASS | FAIL | PENDING */
  academicStatus: 'PASS' | 'FAIL' | 'PENDING';
  /** Promotion outcome for this period if a batch was completed, null otherwise */
  promotionDecision: 'PROMOTED' | 'REPEATED' | 'GRADUATED' | null;
}

export interface TranscriptDto {
  studentId: number;
  studentName: string;
  admissionNumber: string;
  gender: string;
  dateOfBirth: string;
  classroomLabel: string;
  enrolledAt: string;
  dateOfLeavingAt: string | null;
  schoolName: string;
  periods: TranscriptPeriodDto[];
  cumulativeAverage: number | null;
  generatedDate: string;
}

export interface ReportCardSubjectRowDto {
  subjectName:   string;
  totalScore:    number | null;   // null = result not yet finalized
  totalMaxMarks: number;
  percentage:    number | null;
  status:        'PASS' | 'FAIL' | null;  // null = no result
}

export interface ReportCardAttendanceDto {
  present:    number;
  absent:     number;
  late:       number;
  excused:    number;
  totalDays:  number;
  percentage: number;
}

export interface ReportCardDto {
  studentId:       number;
  studentName:     string;
  admissionNumber: string;
  gender:          string;
  dateOfBirth:     string;
  className:       string;
  section:         string;
  semester:        Semester;
  academicYear:    string;
  schoolName:      string;

  subjects:        ReportCardSubjectRowDto[];
  totalObtained:   number;
  totalMaxMarks:   number;
  average:         number;
  rank:            number | null;
  academicStatus:  'PASS' | 'FAIL' | 'PENDING';
  failedSubjects:  string[];

  attendance:      ReportCardAttendanceDto | null;
  generatedDate:   string;
}
