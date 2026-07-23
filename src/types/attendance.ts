export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface AttendanceRecord {
  attendanceId: number;
  studentId: number;
  studentName: string;
  classroomId: number;
  attendanceDate: string;
  status: AttendanceStatus;
  remarks: string | null;
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
  records: BulkAttendanceRecordInput[];
}
