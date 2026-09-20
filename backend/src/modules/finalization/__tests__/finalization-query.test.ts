/**
 * Phase 4.7a — Finalization Service: Query + Correction Tests
 *
 * Covers the methods not tested in finalization.service.test.ts:
 *  - getSubjectFinalization
 *  - getClassroomFinalization
 *  - getClassroomSubjectFinalizations
 *  - correctSubjectFinalization
 *  - correctClassroomFinalization
 *
 * DATABASE SAFETY: all Prisma calls mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { FinalizationService } from '../finalization.service';
import { FinalizationStatus } from '@prisma/client';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    classroom:             { findUnique: vi.fn() },
    teacher:               { findUnique: vi.fn() },
    teacherSubject:        { findUnique: vi.fn(), findMany: vi.fn() },
    gradeSubjectConfig:    { findMany: vi.fn() },
    student:               { findMany: vi.fn() },
    subjectFinalization:   { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    classroomFinalization: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    gradeComponent:        { findMany: vi.fn() },
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false, isDevelopment: false, isTest: true }));
vi.mock('../../../core/audit/audit-recorder', () => ({ recordAudit: vi.fn() }));
vi.mock('../../notifications/notification.service', () => ({ createAutoNotification: vi.fn(), notifyStudentParents: vi.fn() }));

import { prisma } from '../../../database/prisma-client';

// ── Actors ────────────────────────────────────────────────────────────────────

const DIRECTOR  = { userId: 1, role: 'DIRECTOR'      as const, username: 'dir' };
const VD        = { userId: 2, role: 'VICE_DIRECTOR'  as const, username: 'vd'  };
const ADMIN     = { userId: 3, role: 'ADMIN'          as const, username: 'adm' };
const TEACHER_A = { userId: 10, role: 'TEACHER'       as const, username: 'tch' };

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CL9A = { classroomId: 1, className: 'Grade 9', section: 'A', academicYear: '2026/27', homeroomTeacherId: null };
const TEACHER_PROFILE = { teacherId: 100, userId: 10 };
const TS = { id: 1, teacherId: 100, subjectId: 1, classroomId: 1,
  subject: { subjectId: 1, subjectCode: 'ENG', subjectName: 'English' },
  teacher: { teacherId: 100, firstName: 'Tom', lastName: 'T' },
  classroom: CL9A,
};

function mkSubjectFin(status: FinalizationStatus, id = 10) {
  return {
    id, teacherSubjectId: 1, semester: 'SEMESTER_1' as const, academicYear: '2026/27',
    status, reviewedBy: null, reviewedAt: null, finalizedBy: null, finalizedAt: null,
    correctionReason: null, lastCorrectionAt: null,
    createdAt: new Date(), updatedAt: new Date(),
    teacherSubject: TS,
    reviewedByUser: null, finalizedByUser: null,
  };
}

function mkClassroomFin(status: FinalizationStatus, id = 20) {
  return {
    id, classroomId: 1, semester: 'SEMESTER_1' as const, academicYear: '2026/27',
    status, finalizedBy: null, finalizedAt: null,
    correctionReason: null, lastCorrectionAt: null,
    createdAt: new Date(), updatedAt: new Date(),
    classroom: CL9A, finalizedByUser: null,
  };
}

// ── getSubjectFinalization ────────────────────────────────────────────────────

describe('getSubjectFinalization', () => {
  let svc: FinalizationService;
  beforeEach(() => { svc = new FinalizationService(); vi.clearAllMocks(); });

  it('returns the DTO when record exists (DIRECTOR)', async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkSubjectFin(FinalizationStatus.FINALIZED));
    const r = await svc.getSubjectFinalization(DIRECTOR, 1, 'SEMESTER_1', '2026/27');
    expect(r.status).toBe(FinalizationStatus.FINALIZED);
    expect(r.teacherSubjectId).toBe(1);
  });

  it('throws NotFoundError when no record exists', async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.getSubjectFinalization(DIRECTOR, 1, 'SEMESTER_1', '2026/27')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('teacher can view their own subject finalization', async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkSubjectFin(FinalizationStatus.UNDER_REVIEW));
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER_PROFILE);
    (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(TS); // teacherId matches
    const r = await svc.getSubjectFinalization(TEACHER_A, 1, 'SEMESTER_1', '2026/27');
    expect(r).toBeDefined();
  });

  it('teacher is rejected when they do not own the subject', async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkSubjectFin(FinalizationStatus.UNDER_REVIEW));
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER_PROFILE); // teacherId=100
    (prisma.teacherSubject.findUnique as Mock).mockResolvedValue({ ...TS, teacherId: 999 }); // different teacher
    await expect(
      svc.getSubjectFinalization(TEACHER_A, 1, 'SEMESTER_1', '2026/27')
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── getClassroomFinalization ──────────────────────────────────────────────────

describe('getClassroomFinalization', () => {
  let svc: FinalizationService;
  beforeEach(() => { svc = new FinalizationService(); vi.clearAllMocks(); });

  function setupAccess() {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
  }

  it('returns the DTO when record exists', async () => {
    setupAccess();
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(mkClassroomFin(FinalizationStatus.FINALIZED));
    const r = await svc.getClassroomFinalization(DIRECTOR, 1, 'SEMESTER_1', '2026/27');
    expect(r.status).toBe(FinalizationStatus.FINALIZED);
    expect(r.classroomId).toBe(1);
  });

  it('throws NotFoundError when classroom finalization does not exist', async () => {
    setupAccess();
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.getClassroomFinalization(DIRECTOR, 1, 'SEMESTER_1', '2026/27')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('VICE_DIRECTOR can access classroom finalization', async () => {
    setupAccess();
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(mkClassroomFin(FinalizationStatus.FINALIZED));
    const r = await svc.getClassroomFinalization(VD, 1, 'SEMESTER_1', '2026/27');
    expect(r).toBeDefined();
  });
});

// ── getClassroomSubjectFinalizations ──────────────────────────────────────────

describe('getClassroomSubjectFinalizations', () => {
  let svc: FinalizationService;
  beforeEach(() => { svc = new FinalizationService(); vi.clearAllMocks(); });

  function setupBase(teacherSubjects: typeof TS[], fins: ReturnType<typeof mkSubjectFin>[]) {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([
      { subjectId: 1, sortOrder: 0, subject: { subjectId: 1, subjectCode: 'ENG', subjectName: 'English' } },
      { subjectId: 2, sortOrder: 1, subject: { subjectId: 2, subjectCode: 'MATH', subjectName: 'Mathematics' } },
    ]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue(teacherSubjects);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue(fins);
    (prisma.student.findMany as Mock).mockResolvedValue([{ studentId: 101 }, { studentId: 102 }]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
  }

  it('returns one entry per configured subject', async () => {
    setupBase([TS, { ...TS, id: 2, subjectId: 2 }], []);
    const r = await svc.getClassroomSubjectFinalizations(DIRECTOR, 1, 'SEMESTER_1', '2026/27');
    expect(r).toHaveLength(2);
  });

  it('[REGRESSION] required subject with no teacher assignment still appears in result', async () => {
    // Only English has a TeacherSubject — Math has none
    setupBase([TS], []); // only English teacher
    const r = await svc.getClassroomSubjectFinalizations(DIRECTOR, 1, 'SEMESTER_1', '2026/27');
    expect(r).toHaveLength(2);
    const math = r.find((s) => s.subjectName === 'Mathematics')!;
    expect(math).toBeDefined();
    expect(math.teacherName).toContain('No teacher');
    expect(math.status).toBe(FinalizationStatus.DRAFT);
  });

  it('subject with existing finalization row uses its status', async () => {
    setupBase([TS], [mkSubjectFin(FinalizationStatus.FINALIZED)]);
    const r = await svc.getClassroomSubjectFinalizations(DIRECTOR, 1, 'SEMESTER_1', '2026/27');
    const eng = r.find((s) => s.subjectName === 'English')!;
    expect(eng.status).toBe(FinalizationStatus.FINALIZED);
  });

  it('subject with no finalization row defaults to DRAFT status', async () => {
    setupBase([TS], []); // English has TS but no finalization row
    const r = await svc.getClassroomSubjectFinalizations(DIRECTOR, 1, 'SEMESTER_1', '2026/27');
    const eng = r.find((s) => s.subjectName === 'English')!;
    expect(eng.status).toBe(FinalizationStatus.DRAFT);
  });

  it('studentCount equals number of students in classroom', async () => {
    setupBase([TS], []);
    const r = await svc.getClassroomSubjectFinalizations(DIRECTOR, 1, 'SEMESTER_1', '2026/27');
    expect(r[0].studentCount).toBe(2);
  });

  it('missingResultsCount equals studentCount when no grade components defined', async () => {
    setupBase([TS], []);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]); // no components
    const r = await svc.getClassroomSubjectFinalizations(DIRECTOR, 1, 'SEMESTER_1', '2026/27');
    const eng = r.find((s) => s.subjectName === 'English')!;
    expect(eng.missingResultsCount).toBe(2);
  });
});

// ── correctSubjectFinalization ────────────────────────────────────────────────

describe('correctSubjectFinalization', () => {
  let svc: FinalizationService;
  beforeEach(() => { svc = new FinalizationService(); vi.clearAllMocks(); });

  it('reopens FINALIZED subject to UNDER_REVIEW and returns DTO', async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkSubjectFin(FinalizationStatus.FINALIZED));
    (prisma.subjectFinalization.update as Mock).mockResolvedValue(mkSubjectFin(FinalizationStatus.UNDER_REVIEW));
    const r = await svc.correctSubjectFinalization(DIRECTOR, 10, { correctionReason: 'Data entry error' });
    expect(r.status).toBe(FinalizationStatus.UNDER_REVIEW);
    expect(prisma.subjectFinalization.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: FinalizationStatus.UNDER_REVIEW }) })
    );
  });

  it('throws BadRequestError when status is not FINALIZED', async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkSubjectFin(FinalizationStatus.APPROVED));
    await expect(
      svc.correctSubjectFinalization(DIRECTOR, 10, { correctionReason: 'reason' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFoundError when record does not exist', async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.correctSubjectFinalization(DIRECTOR, 999, { correctionReason: 'reason' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('TEACHER cannot correct finalization — throws ForbiddenError', async () => {
    await expect(
      svc.correctSubjectFinalization(TEACHER_A, 10, { correctionReason: 'reason' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('VICE_DIRECTOR can correct finalization', async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkSubjectFin(FinalizationStatus.FINALIZED));
    (prisma.subjectFinalization.update as Mock).mockResolvedValue(mkSubjectFin(FinalizationStatus.UNDER_REVIEW));
    await expect(
      svc.correctSubjectFinalization(VD, 10, { correctionReason: 'Mistake' })
    ).resolves.not.toThrow();
  });

  it('update is NOT called when status check fails', async () => {
    (prisma.subjectFinalization.findUnique as Mock).mockResolvedValue(mkSubjectFin(FinalizationStatus.DRAFT));
    await expect(
      svc.correctSubjectFinalization(DIRECTOR, 10, { correctionReason: 'reason' })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.subjectFinalization.update).not.toHaveBeenCalled();
  });
});

// ── correctClassroomFinalization ──────────────────────────────────────────────

describe('correctClassroomFinalization', () => {
  let svc: FinalizationService;
  beforeEach(() => { svc = new FinalizationService(); vi.clearAllMocks(); });

  it('reopens FINALIZED classroom to UNDER_REVIEW', async () => {
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(mkClassroomFin(FinalizationStatus.FINALIZED));
    (prisma.classroomFinalization.update as Mock).mockResolvedValue(mkClassroomFin(FinalizationStatus.UNDER_REVIEW));
    const r = await svc.correctClassroomFinalization(DIRECTOR, 20, { correctionReason: 'Error found' });
    expect(r.status).toBe(FinalizationStatus.UNDER_REVIEW);
  });

  it('throws BadRequestError when classroom finalization is not FINALIZED', async () => {
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(mkClassroomFin(FinalizationStatus.DRAFT));
    await expect(
      svc.correctClassroomFinalization(DIRECTOR, 20, { correctionReason: 'reason' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFoundError when record does not exist', async () => {
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.correctClassroomFinalization(DIRECTOR, 999, { correctionReason: 'reason' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('TEACHER cannot correct classroom finalization', async () => {
    await expect(
      svc.correctClassroomFinalization(TEACHER_A, 20, { correctionReason: 'reason' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('update is NOT called when forbidden', async () => {
    await expect(
      svc.correctClassroomFinalization(TEACHER_A, 20, { correctionReason: 'reason' })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.classroomFinalization.update).not.toHaveBeenCalled();
  });
});
