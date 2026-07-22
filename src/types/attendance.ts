export interface AttendanceSummary {
  studentId: number;
  totalDaysRecorded: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  presentPercentage: number;
}
