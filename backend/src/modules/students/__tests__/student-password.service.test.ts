/**
 * Phase 4.11 — StudentService: password & credential methods
 *
 * Covers the methods not tested in student.service.test.ts:
 *  - previewGeneratePasswords
 *  - bulkGenerateNewPasswords
 *  - bulkResetClassroomPasswords
 *  - resetStudentPassword
 *  - exportClassroomCredentials
 *
 * DATABASE SAFETY: all Prisma mocked. No real DB required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    classroom:    { findUnique: vi.fn() },
    student:      { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    user:         { update: vi.fn(), create: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    auditLog:     { create: vi.fn().mockResolvedValue({}) },
    role:         { findUnique: vi.fn() },
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));
vi.mock('../../../core/utils/password.util', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
}));
vi.mock('../../../core/utils/code-generator.util', () => ({
  buildBaseUsername:       vi.fn().mockReturnValue('u'),
  ensureUniqueUsername:    vi.fn().mockResolvedValue('u'),
  generateTemporaryPassword: vi.fn().mockReturnValue('TempPass1!'),
}));
vi.mock('../../parents/parent.service', () => ({ parentService: { createParent: vi.fn() } }));

import { StudentService } from '../student.service';
import { prisma } from '../../../database/prisma-client';
import { generateTemporaryPassword } from '../../../core/utils/code-generator.util';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CL = { classroomId: 1, className: 'Grade 9', section: 'A', academicYear: '2026/27' };

function mkStudentWithUser(id = 101, isTemporary = true) {
  return {
    studentId: id, userId: 200 + id, classroomId: 1,
    admissionNumber: `DSH-00${id}`, firstName: 'Alice', lastName: 'A',
    gender: 'F', dateOfBirth: new Date('2010-01-15'), address: null,
    enrolledAt: new Date(), admissionType: 'NEW_STUDENT', studentStatus: 'ACTIVE',
    completionYear: null, lastGradeCompleted: null, previousAcademicSummary: null,
    previousSchoolLocation: null, previousSchoolName: null, previousSchoolType: null,
    previousStudentId: null, transferReason: null, transferCertificateRef: null,
    transferredOutAt: null, transferredOutDestination: null, transferredOutReason: null,
    classroom: CL,
    parentLinks: [],
    user: { userId: 200 + id, username: `DSH-00${id}`, isTemporaryPassword: isTemporary },
  };
}

// ── previewGeneratePasswords ──────────────────────────────────────────────────

describe('previewGeneratePasswords', () => {
  let svc: StudentService;
  beforeEach(() => { svc = new StudentService(); vi.clearAllMocks(); (generateTemporaryPassword as Mock).mockReturnValue('TempPass1!'); });

  it('returns total, eligible, and alreadyPersonal counts', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([
      mkStudentWithUser(101, true),   // temporary → eligible
      mkStudentWithUser(102, false),  // personal → alreadyPersonal
      mkStudentWithUser(103, true),   // temporary → eligible
    ]);
    const r = await svc.previewGeneratePasswords(1);
    expect(r.total).toBe(3);
    expect(r.eligible).toBe(2);
    expect(r.alreadyPersonal).toBe(1);
  });

  it('throws NotFoundError when classroom does not exist', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.previewGeneratePasswords(999)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns all zero when classroom is empty', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([]);
    const r = await svc.previewGeneratePasswords(1);
    expect(r.total).toBe(0);
    expect(r.eligible).toBe(0);
    expect(r.alreadyPersonal).toBe(0);
  });
});

// ── bulkGenerateNewPasswords ──────────────────────────────────────────────────

describe('bulkGenerateNewPasswords', () => {
  let svc: StudentService;
  beforeEach(() => { svc = new StudentService(); vi.clearAllMocks(); (generateTemporaryPassword as Mock).mockReturnValue('TempPass1!'); });

  it('generates passwords for eligible students and skips those with personal passwords', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([
      mkStudentWithUser(101, true),  // eligible
      mkStudentWithUser(102, false), // skip — personal password
    ]);
    (prisma.user.update as Mock).mockResolvedValue({});
    (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 0 });

    const r = await svc.bulkGenerateNewPasswords(1, 1);
    expect(r.generated).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.failed).toBe(0);
    expect(r.total).toBe(2);
    expect(r.results).toHaveLength(1);
    expect(r.results[0].temporaryPassword).toBe('TempPass1!');
  });

  it('throws NotFoundError when classroom does not exist', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.bulkGenerateNewPasswords(999, 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('result includes admissionNumber, username, temporaryPassword', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([mkStudentWithUser(101, true)]);
    (prisma.user.update as Mock).mockResolvedValue({});
    (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 0 });

    const r = await svc.bulkGenerateNewPasswords(1, 1);
    const result = r.results[0];
    expect(result.admissionNumber).toBe('DSH-00101');
    expect(result.username).toBe('DSH-00101');
    expect(result.temporaryPassword).toBe('TempPass1!');
  });

  it('revokes sessions for each processed student', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([mkStudentWithUser(101, true)]);
    (prisma.user.update as Mock).mockResolvedValue({});
    (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 1 });

    await svc.bulkGenerateNewPasswords(1, 1);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ revokedAt: null }) })
    );
  });
});

// ── bulkResetClassroomPasswords ───────────────────────────────────────────────

describe('bulkResetClassroomPasswords', () => {
  let svc: StudentService;
  beforeEach(() => { svc = new StudentService(); vi.clearAllMocks(); (generateTemporaryPassword as Mock).mockReturnValue('TempPass1!'); });

  it('resets ALL active student passwords regardless of isTemporaryPassword', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([
      mkStudentWithUser(101, false), // personal password — still reset
      mkStudentWithUser(102, true),  // temporary — still reset
    ]);
    (prisma.user.update as Mock).mockResolvedValue({});
    (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 0 });

    const r = await svc.bulkResetClassroomPasswords(1, 1);
    expect(r.processed).toBe(2);
    expect(r.results).toHaveLength(2);
  });

  it('throws NotFoundError when classroom does not exist', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.bulkResetClassroomPasswords(999, 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('each result contains isNew=false for existing accounts', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([mkStudentWithUser(101)]);
    (prisma.user.update as Mock).mockResolvedValue({});
    (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 0 });

    const r = await svc.bulkResetClassroomPasswords(1, 1);
    expect(r.results[0].isNew).toBe(false);
  });

  it('returns empty results for empty classroom', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([]);
    const r = await svc.bulkResetClassroomPasswords(1, 1);
    expect(r.processed).toBe(0);
    expect(r.results).toHaveLength(0);
  });
});

// ── resetStudentPassword ──────────────────────────────────────────────────────

describe('resetStudentPassword', () => {
  let svc: StudentService;
  beforeEach(() => { svc = new StudentService(); vi.clearAllMocks(); (generateTemporaryPassword as Mock).mockReturnValue('TempPass1!'); });

  it('resets password and returns username + temporaryPassword', async () => {
    (prisma.student.findUnique as Mock).mockResolvedValue(mkStudentWithUser());
    (prisma.user.update as Mock).mockResolvedValue({});
    (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 0 });

    const r = await svc.resetStudentPassword(101, 1);
    expect(r.username).toBe('DSH-00101');
    expect(r.temporaryPassword).toBe('TempPass1!');
  });

  it('throws NotFoundError when student does not exist', async () => {
    (prisma.student.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.resetStudentPassword(999, 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('revokes all active sessions', async () => {
    (prisma.student.findUnique as Mock).mockResolvedValue(mkStudentWithUser());
    (prisma.user.update as Mock).mockResolvedValue({});
    (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 1 });

    await svc.resetStudentPassword(101, 1);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ revokedAt: null }) })
    );
  });

  it('writes an audit log entry', async () => {
    (prisma.student.findUnique as Mock).mockResolvedValue(mkStudentWithUser());
    (prisma.user.update as Mock).mockResolvedValue({});
    (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 0 });

    await svc.resetStudentPassword(101, 1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'STUDENT_PASSWORD_RESET' }) })
    );
  });
});

// ── exportClassroomCredentials ────────────────────────────────────────────────

describe('exportClassroomCredentials', () => {
  let svc: StudentService;
  beforeEach(() => { svc = new StudentService(); vi.clearAllMocks(); });

  it('returns credential rows for all active students', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([
      mkStudentWithUser(101), mkStudentWithUser(102),
    ]);
    const r = await svc.exportClassroomCredentials(1);
    expect(r).toHaveLength(2);
    expect(r[0].admissionNumber).toBe('DSH-00101');
    expect(r[0].username).toBe('DSH-00101');
    expect(r[0].firstName).toBe('Alice');
  });

  it('returns empty array for empty classroom', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([]);
    const r = await svc.exportClassroomCredentials(1);
    expect(r).toHaveLength(0);
  });

  it('throws NotFoundError when classroom does not exist', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.exportClassroomCredentials(999)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('DTO contains all expected fields', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([mkStudentWithUser(101)]);
    const r = await svc.exportClassroomCredentials(1);
    const row = r[0];
    expect(row).toHaveProperty('studentId');
    expect(row).toHaveProperty('admissionNumber');
    expect(row).toHaveProperty('firstName');
    expect(row).toHaveProperty('lastName');
    expect(row).toHaveProperty('username');
  });
});
