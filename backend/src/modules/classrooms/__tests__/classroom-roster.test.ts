/**
 * Classroom historical roster tests.
 *
 * Verifies that getClassroomRoster() correctly returns the historical student
 * list using StudentEnrollment when records exist, and falls back to
 * Student.classroomId for classrooms not yet part of a promotion cycle.
 *
 * DATABASE SAFETY: all Prisma calls mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ClassroomService } from '../classroom.service';
import { NotFoundError } from '../../../core/errors/app-error';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    classroom:         { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    student:           { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    studentEnrollment: { findMany: vi.fn(), count: vi.fn() },
    teacher:           { findUnique: vi.fn() },
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

import { prisma } from '../../../database/prisma-client';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CL9A_2026 = { classroomId: 1, className: 'Grade 9', section: 'A', academicYear: '2026', homeroomTeacherId: null, session: 'MORNING', homeroomTeacher: null };
const CL10A_2027 = { classroomId: 2, className: 'Grade 10', section: 'A', academicYear: '2027', homeroomTeacherId: null, session: 'MORNING', homeroomTeacher: null };

const STU1 = { studentId: 101, admissionNumber: 'DSH-001', firstName: 'Alice', lastName: 'Bekele', gender: 'F', classroomId: 2 }; // now in Grade 10
const STU2 = { studentId: 102, admissionNumber: 'DSH-002', firstName: 'Bob',   lastName: 'Tadesse', gender: 'M', classroomId: 2 };

const ENROLLMENT_STU1_2026 = { id: 1, studentId: 101, classroomId: 1, academicYear: '2026', decision: 'PROMOTED', student: { ...STU1 } };
const ENROLLMENT_STU2_2026 = { id: 2, studentId: 102, classroomId: 1, academicYear: '2026', decision: 'PROMOTED', student: { ...STU2 } };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ClassroomService.getClassroomRoster — historical enrollment', () => {
  let svc: ClassroomService;
  beforeEach(() => { svc = new ClassroomService(); vi.clearAllMocks(); });

  it('returns historical roster from StudentEnrollment when records exist', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A_2026);
    // Enrollment records exist for 2026 — both students were promoted from this classroom
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([
      ENROLLMENT_STU1_2026,
      ENROLLMENT_STU2_2026,
    ]);

    const result = await svc.getClassroomRoster(1, '2026');

    expect(result.students).toHaveLength(2);
    expect(result.students[0].studentId).toBe(101);
    expect(result.students[1].studentId).toBe(102);
    expect(result.isHistorical).toBe(true); // students have moved to classroomId=2
  });

  it('marks isHistorical=true when students have moved to a different classroom', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A_2026);
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([ENROLLMENT_STU1_2026]);
    // STU1.classroomId=2 but the classroom being queried is classroomId=1

    const result = await svc.getClassroomRoster(1, '2026');
    expect(result.isHistorical).toBe(true);
  });

  it('marks isHistorical=false when students still belong to this classroom', async () => {
    const stuActive = { ...STU1, classroomId: 1 }; // still in classroomId=1
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A_2026);
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([
      { ...ENROLLMENT_STU1_2026, student: stuActive },
    ]);

    const result = await svc.getClassroomRoster(1, '2026');
    expect(result.isHistorical).toBe(false);
  });

  it('falls back to Student.classroomId when no enrollment records exist (pre-promotion)', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A_2027);
    // No enrollment records yet (new class, not yet promoted)
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([]);
    // Live students in this classroom
    (prisma.student.findMany as Mock).mockResolvedValue([
      { ...STU1, classroomId: 2 },
      { ...STU2, classroomId: 2 },
    ]);

    const result = await svc.getClassroomRoster(2, '2027');

    expect(result.students).toHaveLength(2);
    expect(result.isHistorical).toBe(false);
    // enrollmentDecision defaults to 'ACTIVE' for live students
    expect(result.students[0].enrollmentDecision).toBe('ACTIVE');
  });

  it('returns empty student list (not error) when classroom has no enrollments and no live students', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A_2026);
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([]);
    (prisma.student.findMany as Mock).mockResolvedValue([]);

    const result = await svc.getClassroomRoster(1, '2026');
    expect(result.students).toHaveLength(0);
    expect(result.classroomId).toBe(1);
    expect(result.academicYear).toBe('2026');
  });

  it('throws NotFoundError when classroom does not exist', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);

    await expect(svc.getClassroomRoster(999, '2026')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('includes enrollmentDecision in the response for historical records', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A_2026);
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([
      { ...ENROLLMENT_STU1_2026, decision: 'PROMOTED' },
      { ...ENROLLMENT_STU2_2026, decision: 'REPEATED' },
    ]);

    const result = await svc.getClassroomRoster(1, '2026');

    const alice = result.students.find((s) => s.studentId === 101);
    const bob   = result.students.find((s) => s.studentId === 102);
    expect(alice?.enrollmentDecision).toBe('PROMOTED');
    expect(bob?.enrollmentDecision).toBe('REPEATED');
  });

  it('preserves student admission number and names in the roster', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A_2026);
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([ENROLLMENT_STU1_2026]);

    const result = await svc.getClassroomRoster(1, '2026');

    expect(result.students[0].admissionNumber).toBe('DSH-001');
    expect(result.students[0].firstName).toBe('Alice');
    expect(result.students[0].lastName).toBe('Bekele');
  });

  it('returns the classroom metadata (className, section, academicYear) regardless of student count', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A_2026);
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([]);
    (prisma.student.findMany as Mock).mockResolvedValue([]);

    const result = await svc.getClassroomRoster(1, '2026');

    expect(result.className).toBe('Grade 9');
    expect(result.section).toBe('A');
    expect(result.academicYear).toBe('2026');
  });
});

describe('ClassroomService.getClassroomRoster — viewing current year roster', () => {
  let svc: ClassroomService;
  beforeEach(() => { svc = new ClassroomService(); vi.clearAllMocks(); });

  it('returns current-year students when accessed in the same year', async () => {
    const stuActive = { ...STU1, classroomId: 1 }; // still in Grade 9 A
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A_2026);
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([
      { ...ENROLLMENT_STU1_2026, decision: 'ACTIVE', student: stuActive },
    ]);

    const result = await svc.getClassroomRoster(1, '2026');

    expect(result.students).toHaveLength(1);
    expect(result.isHistorical).toBe(false);
  });

  it('same student appears in 2026 Grade 9 A AND 2027 Grade 10 A after promotion', async () => {
    const svc2 = new ClassroomService();
    vi.clearAllMocks();

    // Query 2026 Grade 9 A — historical
    (prisma.classroom.findUnique as Mock).mockResolvedValueOnce(CL9A_2026);
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValueOnce([ENROLLMENT_STU1_2026]);
    const roster2026 = await svc2.getClassroomRoster(1, '2026');
    expect(roster2026.students.find((s) => s.studentId === 101)).toBeDefined();

    // Query 2027 Grade 10 A — current
    const enrollment2027 = { id: 3, studentId: 101, classroomId: 2, academicYear: '2027', decision: 'ACTIVE', student: { ...STU1, classroomId: 2 } };
    (prisma.classroom.findUnique as Mock).mockResolvedValueOnce(CL10A_2027);
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValueOnce([enrollment2027]);
    const roster2027 = await svc2.getClassroomRoster(2, '2027');
    expect(roster2027.students.find((s) => s.studentId === 101)).toBeDefined();

    // Student appears in both rosters with their permanent ID
    expect(roster2026.students[0].studentId).toBe(roster2027.students[0].studentId);
  });
});
