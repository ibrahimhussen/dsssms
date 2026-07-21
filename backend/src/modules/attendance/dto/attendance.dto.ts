import { AttendanceStatus } from '@prisma/client';

export interface AttendanceRecordDto {
  attendanceId: number;
  studentId: number;
  studentName: string;
  classroomId: number;
  attendanceDate: Date;
  status: AttendanceStatus;
  remarks: string | null;
  recordedBy: { teacherId: number; firstName: string; lastName: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceSummaryDto {
  studentId: number;
  totalDaysRecorded: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  presentPercentage: number;
}

export interface BulkAttendanceResultDto {
  classroomId: number;
  attendanceDate: Date;
  recordsSaved: number;
}
