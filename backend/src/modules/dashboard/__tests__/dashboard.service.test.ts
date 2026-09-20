/**
 * Phase 4.9 — DashboardService Tests
 * DATABASE SAFETY: all Prisma mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    student:        { count: vi.fn(), findMany: vi.fn() },
    teacher:        { count: vi.fn(), findMany: vi.fn() },
    parent:         { count: vi.fn() },
    subject:        { count: vi.fn() },
    classroom:      { count: vi.fn(), findMany: vi.fn() },
    user:           { count: vi.fn(), findMany: vi.fn() },
    attendance:     { findMany: vi.fn(), groupBy: vi.fn() },
    academicReport: { findMany: vi.fn() },
    gradeComponent: { findMany: vi.fn() },
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

import { DashboardService } from '../dashboard.service';
import { prisma } from '../../../database/prisma-client';

describe('DashboardService', () => {
  let svc: DashboardService;

  beforeEach(() => { svc = new DashboardService(); vi.clearAllMocks(); });

  // ── getAdminDashboard ──────────────────────────────────────────────────────

  describe('getAdminDashboard', () => {
    function setupAdmin() {
      (prisma.student.count   as Mock).mockResolvedValue(120);
      (prisma.teacher.count   as Mock).mockResolvedValue(15);
      (prisma.parent.count    as Mock).mockResolvedValue(80);
      (prisma.user.count      as Mock).mockResolvedValue(20);
      (prisma.subject.count   as Mock).mockResolvedValue(10);
      (prisma.classroom.count as Mock).mockResolvedValue(8);
      (prisma.student.findMany as Mock).mockResolvedValue([]);
      (prisma.teacher.findMany as Mock).mockResolvedValue([]);
      (prisma.user.findMany   as Mock).mockResolvedValue([]);
    }

    it('returns stats with correct counts', async () => {
      setupAdmin();
      const r = await svc.getAdminDashboard();
      expect(r.stats.totalStudents).toBe(120);
      expect(r.stats.totalTeachers).toBe(15);
      expect(r.stats.totalParents).toBe(80);
      expect(r.stats.totalSubjects).toBe(10);
      expect(r.stats.totalClassrooms).toBe(8);
      expect(r.stats.systemStatus).toBe('Operational');
    });

    it('returns empty recent arrays when no data', async () => {
      setupAdmin();
      const r = await svc.getAdminDashboard();
      expect(r.recentStudents).toHaveLength(0);
      expect(r.recentTeachers).toHaveLength(0);
      expect(r.recentLogins).toHaveLength(0);
    });

    it('maps recentStudents with ISO enrolledAt', async () => {
      setupAdmin();
      (prisma.student.findMany as Mock).mockResolvedValue([{
        studentId: 1, firstName: 'Alice', lastName: 'A',
        admissionNumber: 'DSH-001', enrolledAt: new Date('2026-09-01'),
      }]);
      const r = await svc.getAdminDashboard();
      expect(r.recentStudents[0].admissionNumber).toBe('DSH-001');
      expect(typeof r.recentStudents[0].enrolledAt).toBe('string');
    });

    it('maps recentLogins with role and ISO lastLoginAt', async () => {
      setupAdmin();
      (prisma.user.findMany as Mock).mockResolvedValue([{
        userId: 1, username: 'dir', lastLoginAt: new Date('2026-09-10T08:00:00Z'),
        role: { roleName: 'DIRECTOR' },
      }]);
      const r = await svc.getAdminDashboard();
      expect(r.recentLogins[0].role).toBe('DIRECTOR');
      expect(r.recentLogins[0].lastLoginAt).toBe('2026-09-10T08:00:00.000Z');
    });
  });

  // ── getDirectorDashboard ───────────────────────────────────────────────────

  describe('getDirectorDashboard', () => {
    function setupDirector() {
      (prisma.student.count   as Mock).mockResolvedValue(100);
      (prisma.teacher.count   as Mock).mockResolvedValue(10);
      // computeAttendanceTrend — attendance.findMany
      (prisma.attendance.findMany as Mock).mockResolvedValue([]);
      // computeSubjectPerformance — gradeComponent.findMany
      (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
      // computeSubjectPerformance also uses academicReport.findMany (subject averages)
      (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
      // computeGradePerformanceAndPassRate — academicReport.findMany + classroom.findMany
      // getClassroomsWithStudents — classroom.findMany
      (prisma.classroom.findMany as Mock).mockResolvedValue([]);
    }

    it('returns stats with totalStudents and totalTeachers', async () => {
      setupDirector();
      const r = await svc.getDirectorDashboard();
      expect(r.stats.totalStudents).toBe(100);
      expect(r.stats.totalTeachers).toBe(10);
    });

    it('returns charts object with attendanceTrend array', async () => {
      setupDirector();
      const r = await svc.getDirectorDashboard();
      expect(Array.isArray(r.charts.attendanceTrend)).toBe(true);
    });

    it('returns charts object with subjectPerformance array', async () => {
      setupDirector();
      const r = await svc.getDirectorDashboard();
      expect(Array.isArray(r.charts.subjectPerformance)).toBe(true);
    });

    it('returns charts object with performanceByGrade array', async () => {
      setupDirector();
      const r = await svc.getDirectorDashboard();
      expect(Array.isArray(r.charts.performanceByGrade)).toBe(true);
    });

    it('topPerformingGrade is null when no academic reports exist', async () => {
      setupDirector();
      const r = await svc.getDirectorDashboard();
      expect(r.stats.topPerformingGrade).toBeNull();
    });
  });

  // ── getViceDirectorDashboard ───────────────────────────────────────────────

  describe('getViceDirectorDashboard', () => {
    function setupVD() {
      (prisma.teacher.count   as Mock).mockResolvedValue(10);
      (prisma.classroom.count as Mock).mockResolvedValue(8);
      (prisma.classroom.findMany as Mock).mockResolvedValue([]);
      (prisma.attendance.groupBy  as Mock).mockResolvedValue([]);
      // computeAttendanceTrend (weekly) + findMany for classroomsWithAttendanceToday
      (prisma.attendance.findMany as Mock).mockResolvedValue([]);
    }

    it('returns totalTeachers and totalClasses in stats', async () => {
      setupVD();
      const r = await svc.getViceDirectorDashboard();
      expect(r.stats.totalTeachers).toBe(10);
      expect(r.stats.totalClasses).toBe(8);
    });

    it('returns studentsPresentToday and studentsAbsentToday', async () => {
      setupVD();
      const r = await svc.getViceDirectorDashboard();
      expect(typeof r.stats.studentsPresentToday).toBe('number');
      expect(typeof r.stats.studentsAbsentToday).toBe('number');
    });

    it('returns attendancePercentageToday as 0 when no records', async () => {
      setupVD();
      const r = await svc.getViceDirectorDashboard();
      expect(r.stats.attendancePercentageToday).toBe(0);
    });

    it('returns charts.dailyAttendance array with 4 status entries', async () => {
      setupVD();
      const r = await svc.getViceDirectorDashboard();
      expect(Array.isArray(r.charts.dailyAttendance)).toBe(true);
      expect(r.charts.dailyAttendance).toHaveLength(4);
    });

    it('returns charts.weeklyAttendance array', async () => {
      setupVD();
      const r = await svc.getViceDirectorDashboard();
      expect(Array.isArray(r.charts.weeklyAttendance)).toBe(true);
    });
  });
});
