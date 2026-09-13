import type { Semester } from './grade';

export interface AcademicReport {
  reportId: number;
  studentId: number;
  studentName: string;
  semester: Semester;
  academicYear: string;
  averageMark: number;
  rank: number | null;
  generatedDate: string;
}

export interface ReportCardSubjectRow {
  subjectName:   string;
  totalScore:    number | null;
  totalMaxMarks: number;
  percentage:    number | null;
  status:        'PASS' | 'FAIL' | null;
}

export interface ReportCardAttendance {
  present:    number;
  absent:     number;
  late:       number;
  excused:    number;
  totalDays:  number;
  percentage: number;
}

export interface ReportCard {
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
  subjects:        ReportCardSubjectRow[];
  totalObtained:   number;
  totalMaxMarks:   number;
  average:         number;
  rank:            number | null;
  academicStatus:  'PASS' | 'FAIL' | 'PENDING';
  failedSubjects:  string[];
  attendance:      ReportCardAttendance | null;
  generatedDate:   string;
}

export interface GenerateClassroomReportsInput {
  classroomId: number;
  semester: Semester;
  academicYear: string;
}

export interface GenerateReportsResult {
  generated: AcademicReport[];
  skippedStudentIds: number[];
}

export interface TranscriptSubjectRow {
  subjectName: string;
  totalScore: number;
  totalMaxMarks: number;
  percentage: number;
}

export interface TranscriptPeriod {
  semester: Semester;
  academicYear: string;
  className: string;
  section: string;
  subjects: TranscriptSubjectRow[];
  totalObtained: number;
  totalMaxMarks: number;
  periodAverage: number;
  rank: number | null;
  academicStatus: 'PASS' | 'FAIL' | 'PENDING';
  promotionDecision: 'PROMOTED' | 'REPEATED' | 'GRADUATED' | null;
}

export interface Transcript {
  studentId: number;
  studentName: string;
  admissionNumber: string;
  gender: string;
  dateOfBirth: string;
  classroomLabel: string;
  enrolledAt: string;
  dateOfLeavingAt: string | null;
  schoolName: string;
  periods: TranscriptPeriod[];
  cumulativeAverage: number | null;
  generatedDate: string;
}
