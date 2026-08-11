export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface AttendanceRecord {
  attendanceId: number;
  studentId: number;
  studentName: string;
  classroomId: number;
  attendanceDate: string;
  period: number;
  status: AttendanceStatus;
  remarks: string | null;
  isLocked: boolean;
  recordedBy: { teacherId: number; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceSummary {
  studentId: number;
  totalDaysRecorded: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  presentPercentage: number;
}

export interface BulkAttendanceRecordInput {
  studentId: number;
  status: AttendanceStatus;
  remarks?: string;
}

export interface BulkMarkAttendanceInput {
  classroomId: number;
  attendanceDate: string;
  period: number;
  records: BulkAttendanceRecordInput[];
}

export interface ClassroomAttendanceQuery {
  classroomId: number;
  attendanceDate: string;
  period?: number;
}

export interface AttendanceHistoryParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
}

export interface AttendanceSummaryParams {
  from?: string;
  to?: string;
}
