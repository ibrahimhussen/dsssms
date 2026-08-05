import type { AttendanceStatus } from './attendance';

export interface RecentStudent {
  studentId: number;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  enrolledAt: string;
}

export interface RecentTeacher {
  teacherId: number;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface RecentLogin {
  userId: number;
  username: string;
  role: string;
  lastLoginAt: string;
}

export interface AdminDashboard {
  stats: {
    totalStudents: number;
    totalTeachers: number;
    totalParents: number;
    totalStaffAccounts: number;
    totalSubjects: number;
    totalClassrooms: number;
    activeUsersToday: number;
    systemStatus: 'Operational';
  };
  recentStudents: RecentStudent[];
  recentTeachers: RecentTeacher[];
  recentLogins: RecentLogin[];
}

export interface GradePerformancePoint {
  classroomId: number;
  classroomLabel: string;
  averageScore: number;
  studentCount: number;
}

export interface AttendanceTrendPoint {
  date: string;
  presentPercentage: number;
  totalRecorded: number;
}

export interface SubjectPerformancePoint {
  subjectId: number;
  subjectName: string;
  averageScore: number;
}

export interface PassRatePoint {
  classroomId: number;
  classroomLabel: string;
  passRate: number;
  studentCount: number;
}

export interface DirectorDashboard {
  stats: {
    totalStudents: number;
    totalTeachers: number;
    attendanceRateToday: number;
    overallAverageScore: number;
    topPerformingGrade: { classroomLabel: string; averageScore: number } | null;
    pendingAcademicReports: number;
  };
  charts: {
    performanceByGrade: GradePerformancePoint[];
    attendanceTrend: AttendanceTrendPoint[];
    subjectPerformance: SubjectPerformancePoint[];
    passRateAnalysis: PassRatePoint[];
  };
}

export interface AttendanceStatusBreakdown {
  status: AttendanceStatus;
  count: number;
}

export interface ViceDirectorDashboard {
  stats: {
    studentsPresentToday: number;
    studentsAbsentToday: number;
    totalTeachers: number;
    totalClasses: number;
    attendancePercentageToday: number;
    pendingAttendanceReports: number;
  };
  charts: {
    dailyAttendance: AttendanceStatusBreakdown[];
    weeklyAttendance: AttendanceTrendPoint[];
  };
}
