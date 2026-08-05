export interface RecentStudentDto {
  studentId: number;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  enrolledAt: string;
}

export interface RecentTeacherDto {
  teacherId: number;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface RecentLoginDto {
  userId: number;
  username: string;
  role: string;
  lastLoginAt: string;
}

export interface AdminDashboardDto {
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
  recentStudents: RecentStudentDto[];
  recentTeachers: RecentTeacherDto[];
  recentLogins: RecentLoginDto[];
}

export interface GradePerformancePointDto {
  classroomId: number;
  classroomLabel: string;
  averageScore: number;
  studentCount: number;
}

export interface AttendanceTrendPointDto {
  date: string;
  presentPercentage: number;
  totalRecorded: number;
}

export interface SubjectPerformancePointDto {
  subjectId: number;
  subjectName: string;
  averageScore: number;
}

export interface PassRatePointDto {
  classroomId: number;
  classroomLabel: string;
  passRate: number;
  studentCount: number;
}

export interface DirectorDashboardDto {
  stats: {
    totalStudents: number;
    totalTeachers: number;
    attendanceRateToday: number;
    overallAverageScore: number;
    topPerformingGrade: { classroomLabel: string; averageScore: number } | null;
    pendingAcademicReports: number;
  };
  charts: {
    performanceByGrade: GradePerformancePointDto[];
    attendanceTrend: AttendanceTrendPointDto[];
    subjectPerformance: SubjectPerformancePointDto[];
    passRateAnalysis: PassRatePointDto[];
  };
}

export interface AttendanceStatusBreakdownDto {
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  count: number;
}

export interface ViceDirectorDashboardDto {
  stats: {
    studentsPresentToday: number;
    studentsAbsentToday: number;
    totalTeachers: number;
    totalClasses: number;
    attendancePercentageToday: number;
    pendingAttendanceReports: number;
  };
  charts: {
    dailyAttendance: AttendanceStatusBreakdownDto[];
    weeklyAttendance: AttendanceTrendPointDto[];
  };
}
