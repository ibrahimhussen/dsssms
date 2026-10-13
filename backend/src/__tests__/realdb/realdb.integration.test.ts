/**
 * Phase 4.15 — Real MySQL/Prisma Integration Tests
 *
 * Uses the project's actual @prisma/adapter-mariadb driver (matching
 * src/database/prisma-client.ts). Every test that writes data wraps mutations
 * in a Prisma $transaction that is DELIBERATELY thrown to force a rollback,
 * leaving dsssms_db unchanged. Tests that need a clean committed state perform
 * explicit cleanup in a finally block.
 *
 * Run in isolation (DB must be seeded):
 *   $env:DATABASE_URL = "mysql://dsssms_user:mudasir@localhost:3306/dsssms_db"
 *   npx vitest run --config vitest.realdb.config.ts
 *
 * Tests:
 *   A. Transaction commit/rollback isolation (InnoDB)
 *   B. StudentIdCounter — $transaction + row-lock increment + rollback
 *   C. FK / unique constraint enforcement
 *   D. Promotion batch — submit → approve → enrollment records + rollback
 *   E. BackupService.create — reads all 31 tables from real DB
 *   F. BackupService.saveUploaded — valid and invalid payload validation
 *   G. GradeComponent creation + entry recording (real upsert)
 *   H. Attendance write + rollback isolation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { BackupService } from '../../modules/backups/backup.service';

// ── Build a dedicated Prisma client using the project's adapter pattern ────────

function createTestPrisma(): PrismaClient {
  const url = new URL(
    process.env.DATABASE_URL ?? 'mysql://dsssms_user:mudasir@localhost:3306/dsssms_db'
  );
  const adapter = new PrismaMariaDb({
    host:     url.hostname,
    port:     url.port ? Number(url.port) : 3306,
    user:     decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit:         3,
    allowPublicKeyRetrieval: true,
  });
  return new PrismaClient({ adapter });
}

const db = createTestPrisma();

beforeAll(async () => { await db.$connect(); });
afterAll(async ()  => { await db.$disconnect(); });

// ── Seed constants (verified against dsssms_db seed data) ─────────────────────

const SEED = {
  adminUserId:        1,
  directorUserId:     3,
  viceDirectorUserId: 4,
  teacherUserId:      2,   // abebe.kebede, teacherId=1, classroomId=1
  teacher1Id:         1,

  grade9A:        1,   // Grade 9 A 2026/27
  grade9C_2027:   17,  // Grade 9 C 2027 — target for promotion

  student1Id: 1,   // husen Ahmed  — classroomId=1
  student2Id: 2,   // chaltu sani  — classroomId=1

  counterYear: 2026,
};

const ADMIN = { userId: SEED.adminUserId, role: 'ADMIN' as const, username: 'admin' };

// ── Sentinel to force rollback inside $transaction ────────────────────────────

const ROLLBACK = 'DELIBERATE_ROLLBACK';

async function withRollback(fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<void>): Promise<void> {
  await db.$transaction(async (tx) => {
    await fn(tx);
    throw new Error(ROLLBACK);
  }).catch((e: Error) => {
    if (e.message !== ROLLBACK) throw e;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// A. Transaction commit / rollback isolation
// ═══════════════════════════════════════════════════════════════════════════════

describe('A. Transaction commit/rollback isolation', () => {
  it('row inserted inside a rolled-back transaction is not visible after rollback', async () => {
    const title = `__rb_a1_${Date.now()}__`;
    const before = await db.notification.count({ where: { title } });

    await withRollback(async (tx) => {
      await tx.notification.create({
        data: { recipientUserId: SEED.directorUserId, senderUserId: SEED.adminUserId, category: 'SYSTEM', title, message: 'rollback test' },
      });
      const during = await tx.notification.count({ where: { title } });
      expect(during).toBe(1);
    });

    const after = await db.notification.count({ where: { title } });
    expect(after).toBe(0);
    expect(after).toBe(before);
  });

  it('row inserted in a committed transaction IS visible and can be cleaned up', async () => {
    const title = `__commit_a2_${Date.now()}__`;

    await db.$transaction(async (tx) => {
      await tx.notification.create({
        data: { recipientUserId: SEED.directorUserId, senderUserId: SEED.adminUserId, category: 'SYSTEM', title, message: 'commit test' },
      });
    });

    const found = await db.notification.count({ where: { title } });
    expect(found).toBe(1);
    await db.notification.deleteMany({ where: { title } });
    expect(await db.notification.count({ where: { title } })).toBe(0);
  });

  it('partial write: only first step of a multi-step tx leaves no orphan on rollback', async () => {
    const titleA = `__partial_A_${Date.now()}__`;
    const titleB = `__partial_B_${Date.now()}__`;

    await withRollback(async (tx) => {
      await tx.notification.create({ data: { recipientUserId: SEED.directorUserId, senderUserId: SEED.adminUserId, category: 'SYSTEM', title: titleA, message: 'step1' } });
      await tx.notification.create({ data: { recipientUserId: SEED.directorUserId, senderUserId: SEED.adminUserId, category: 'SYSTEM', title: titleB, message: 'step2' } });
    });

    expect(await db.notification.count({ where: { title: titleA } })).toBe(0);
    expect(await db.notification.count({ where: { title: titleB } })).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B. StudentIdCounter — $transaction + row-lock increment + rollback
// ═══════════════════════════════════════════════════════════════════════════════

describe('B. StudentIdCounter — row-lock increment inside $transaction', () => {
  it('increments counter inside tx, counter is rolled back', async () => {
    const before = await db.studentIdCounter.findUnique({ where: { year: SEED.counterYear } });
    const seqBefore = before?.lastSequence ?? 0;

    await withRollback(async (tx) => {
      const updated = await tx.studentIdCounter.update({
        where: { year: SEED.counterYear },
        data:  { lastSequence: { increment: 1 } },
      });
      expect(updated.lastSequence).toBe(seqBefore + 1);
    });

    const after = await db.studentIdCounter.findUnique({ where: { year: SEED.counterYear } });
    expect(after?.lastSequence).toBe(seqBefore); // rolled back
  });

  it('two sequential counter increments produce strictly sequential values', async () => {
    const before = await db.studentIdCounter.findUnique({ where: { year: SEED.counterYear } });
    const seqBefore = before?.lastSequence ?? 0;

    let seq1 = 0, seq2 = 0;
    const userId1 = { v: 0 }, userId2 = { v: 0 };
    const role = await db.role.findUnique({ where: { roleName: 'STUDENT' } });

    try {
      // First transaction — commit
      await db.$transaction(async (tx) => {
        const c1 = await tx.studentIdCounter.update({ where: { year: SEED.counterYear }, data: { lastSequence: { increment: 1 } } });
        seq1 = c1.lastSequence;
        const u = await tx.user.create({ data: { username: `DSH-SEQ-${seq1}`, passwordHash: 'x', roleId: role!.roleId, status: 'ACTIVE', isTemporaryPassword: true, updatedAt: new Date() } });
        userId1.v = u.userId;
      });

      // Second transaction — commit
      await db.$transaction(async (tx) => {
        const c2 = await tx.studentIdCounter.update({ where: { year: SEED.counterYear }, data: { lastSequence: { increment: 1 } } });
        seq2 = c2.lastSequence;
        const u = await tx.user.create({ data: { username: `DSH-SEQ-${seq2}`, passwordHash: 'x', roleId: role!.roleId, status: 'ACTIVE', isTemporaryPassword: true, updatedAt: new Date() } });
        userId2.v = u.userId;
      });

      expect(seq1).toBe(seqBefore + 1);
      expect(seq2).toBe(seqBefore + 2);
      expect(seq2 - seq1).toBe(1); // strictly sequential
    } finally {
      // Restore state
      if (userId1.v) await db.user.deleteMany({ where: { userId: userId1.v } }).catch(() => {});
      if (userId2.v) await db.user.deleteMany({ where: { userId: userId2.v } }).catch(() => {});
      await db.studentIdCounter.update({ where: { year: SEED.counterYear }, data: { lastSequence: seqBefore } });
    }
  });

  it('full createStudent flow: user + student created together, rollback leaves nothing', async () => {
    const seqBefore = (await db.studentIdCounter.findUnique({ where: { year: SEED.counterYear } }))?.lastSequence ?? 0;
    const role = await db.role.findUnique({ where: { roleName: 'STUDENT' } });

    let createdUserId: number | null = null;
    let createdStudentId: number | null = null;

    await withRollback(async (tx) => {
      const c = await tx.studentIdCounter.update({ where: { year: SEED.counterYear }, data: { lastSequence: { increment: 1 } } });
      const admNo = `DSH-${SEED.counterYear}-${String(c.lastSequence).padStart(5, '0')}`;
      const user = await tx.user.create({ data: { username: admNo, passwordHash: 'x', roleId: role!.roleId, status: 'ACTIVE', isTemporaryPassword: true, updatedAt: new Date() } });
      createdUserId = user.userId;
      const student = await tx.student.create({
        data: { userId: user.userId, classroomId: SEED.grade9A, admissionNumber: admNo, firstName: 'RealDB', lastName: 'Test', gender: 'M', dateOfBirth: new Date('2010-01-01'), admissionType: 'NEW_STUDENT', studentStatus: 'ACTIVE' },
      });
      createdStudentId = student.studentId;

      // Verify inside tx
      expect(await tx.student.findUnique({ where: { studentId: student.studentId } })).not.toBeNull();
      expect(await tx.studentIdCounter.findUnique({ where: { year: SEED.counterYear } })).toMatchObject({ lastSequence: seqBefore + 1 });
    });

    // All rolled back
    const afterCounter = await db.studentIdCounter.findUnique({ where: { year: SEED.counterYear } });
    expect(afterCounter?.lastSequence).toBe(seqBefore);
    if (createdUserId)    expect(await db.user.findUnique({ where: { userId: createdUserId } })).toBeNull();
    if (createdStudentId) expect(await db.student.findUnique({ where: { studentId: createdStudentId } })).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// C. FK / unique constraint enforcement
// ═══════════════════════════════════════════════════════════════════════════════

describe('C. FK / unique constraint enforcement', () => {
  it('duplicate username violates unique constraint (P2002)', async () => {
    await expect(
      db.user.create({ data: { username: 'admin', passwordHash: 'x', roleId: 1, status: 'ACTIVE', isTemporaryPassword: false, updatedAt: new Date() } })
    ).rejects.toThrow();
  });

  it('non-existent classroomId violates FK constraint (P2003)', async () => {
    const role = await db.role.findUnique({ where: { roleName: 'STUDENT' } });
    const tempUser = await db.user.create({
      data: { username: `__fk_test_${Date.now()}__`, passwordHash: 'x', roleId: role!.roleId, status: 'ACTIVE', isTemporaryPassword: true, updatedAt: new Date() },
    });
    try {
      await expect(
        db.student.create({
          data: { userId: tempUser.userId, classroomId: 999999, admissionNumber: `FK-${Date.now()}`, firstName: 'FK', lastName: 'T', gender: 'M', dateOfBirth: new Date('2010-01-01'), admissionType: 'NEW_STUDENT', studentStatus: 'ACTIVE' },
        })
      ).rejects.toThrow();
    } finally {
      await db.user.deleteMany({ where: { userId: tempUser.userId } }).catch(() => {});
    }
  });

  it('duplicate admissionNumber violates unique constraint', async () => {
    const role = await db.role.findUnique({ where: { roleName: 'STUDENT' } });
    const tempUser = await db.user.create({
      data: { username: `__dup_adm_${Date.now()}__`, passwordHash: 'x', roleId: role!.roleId, status: 'ACTIVE', isTemporaryPassword: true, updatedAt: new Date() },
    });
    try {
      await expect(
        db.student.create({
          data: { userId: tempUser.userId, classroomId: SEED.grade9A, admissionNumber: 'DSH-2026-00001', firstName: 'Dup', lastName: 'T', gender: 'M', dateOfBirth: new Date('2010-01-01'), admissionType: 'NEW_STUDENT', studentStatus: 'ACTIVE' },
        })
      ).rejects.toThrow();
    } finally {
      await db.user.deleteMany({ where: { userId: tempUser.userId } }).catch(() => {});
    }
  });

  it('duplicate (className, section, academicYear) violates classroom unique constraint', async () => {
    await expect(
      db.classroom.create({ data: { className: 'Grade 9', section: 'A', academicYear: '2026/27', session: 'MORNING' } })
    ).rejects.toThrow();
  });

  it('duplicate (teacherSubjectId, semester, academicYear, name) violates GradeComponent unique constraint', async () => {
    const ts = await db.teacherSubject.findFirst();
    if (!ts) { console.warn('No TeacherSubject — skipping'); return; }

    const name = `__unique_gc_${Date.now()}__`;
    const comp = await db.gradeComponent.create({
      data: { teacherSubjectId: ts.id, semester: 'SEMESTER_1', academicYear: '2026/27', category: 'QUIZ', name, maxMarks: 10 },
    });
    try {
      await expect(
        db.gradeComponent.create({ data: { teacherSubjectId: ts.id, semester: 'SEMESTER_1', academicYear: '2026/27', category: 'QUIZ', name, maxMarks: 10 } })
      ).rejects.toThrow();
    } finally {
      await db.gradeComponent.deleteMany({ where: { gradeComponentId: comp.gradeComponentId } }).catch(() => {});
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D. Promotion batch — submit → approve → enrollment records
// ═══════════════════════════════════════════════════════════════════════════════

describe('D. Promotion batch — real approval flow', () => {
  it('SUBMITTED status persists after update', async () => {
    const batch = await db.promotionBatch.create({
      data: { sourceClassroomId: SEED.grade9A, sourceAcademicYear: '2026/27', targetAcademicYear: '2027', status: 'DRAFT', preparedById: SEED.viceDirectorUserId, updatedAt: new Date() },
    });
    try {
      await db.promotionBatch.update({ where: { id: batch.id }, data: { status: 'SUBMITTED', submittedAt: new Date(), updatedAt: new Date() } });
      const reread = await db.promotionBatch.findUnique({ where: { id: batch.id } });
      expect(reread?.status).toBe('SUBMITTED');
    } finally {
      await db.promotionBatch.deleteMany({ where: { id: batch.id } }).catch(() => {});
    }
  });

  it('approveBatch: student moves to target classroom + enrollment records created + rolled back', async () => {
    const origClassroom = (await db.student.findUnique({ where: { studentId: SEED.student1Id } }))!.classroomId;

    const batch = await db.promotionBatch.create({
      data: {
        sourceClassroomId: SEED.grade9A, sourceAcademicYear: '2026/27', targetAcademicYear: '2027',
        status: 'SUBMITTED', preparedById: SEED.viceDirectorUserId, submittedAt: new Date(), updatedAt: new Date(),
        entries: { create: [{ studentId: SEED.student1Id, decision: 'PROMOTED', eligibilityStatus: 'ELIGIBLE', targetClassroomId: SEED.grade9C_2027, updatedAt: new Date() }] },
      },
      include: { entries: true },
    });

    try {
      await withRollback(async (tx) => {
        const targetCl = await tx.classroom.findUniqueOrThrow({ where: { classroomId: SEED.grade9C_2027 } });

        await tx.studentEnrollment.upsert({
          where:  { studentId_academicYear: { studentId: SEED.student1Id, academicYear: '2026/27' } },
          create: { studentId: SEED.student1Id, classroomId: SEED.grade9A, academicYear: '2026/27', decision: 'PROMOTED', batchId: batch.id },
          update: { decision: 'PROMOTED', batchId: batch.id },
        });
        await tx.studentEnrollment.create({
          data: { studentId: SEED.student1Id, classroomId: SEED.grade9C_2027, academicYear: targetCl.academicYear, decision: 'ACTIVE', batchId: batch.id },
        });
        await tx.student.update({ where: { studentId: SEED.student1Id }, data: { classroomId: SEED.grade9C_2027 } });
        await tx.promotionBatch.update({ where: { id: batch.id }, data: { status: 'COMPLETED', approvedById: SEED.directorUserId, approvedAt: new Date(), completedAt: new Date(), updatedAt: new Date() } });

        // Inside tx: student moved, batch COMPLETED
        const s = await tx.student.findUnique({ where: { studentId: SEED.student1Id } });
        expect(s?.classroomId).toBe(SEED.grade9C_2027);
        const b = await tx.promotionBatch.findUnique({ where: { id: batch.id } });
        expect(b?.status).toBe('COMPLETED');
        const enr = await tx.studentEnrollment.findMany({ where: { studentId: SEED.student1Id, batchId: batch.id } });
        expect(enr.length).toBeGreaterThanOrEqual(1);
      });

      // After rollback: student still in original classroom
      const s = await db.student.findUnique({ where: { studentId: SEED.student1Id } });
      expect(s?.classroomId).toBe(origClassroom);

      // Batch still SUBMITTED (not COMPLETED)
      const b = await db.promotionBatch.findUnique({ where: { id: batch.id } });
      expect(b?.status).toBe('SUBMITTED');

      // No enrollment records leaked
      const enr = await db.studentEnrollment.findMany({ where: { studentId: SEED.student1Id, batchId: batch.id } });
      expect(enr.length).toBe(0);
    } finally {
      await db.studentEnrollment.deleteMany({ where: { batchId: batch.id } }).catch(() => {});
      await db.promotionEntry.deleteMany({ where: { batchId: batch.id } }).catch(() => {});
      await db.promotionBatch.deleteMany({ where: { id: batch.id } }).catch(() => {});
      await db.student.update({ where: { studentId: SEED.student1Id }, data: { classroomId: origClassroom } }).catch(() => {});
    }
  });

  it('approval rollback on mid-tx error leaves student in original classroom', async () => {
    const orig = (await db.student.findUnique({ where: { studentId: SEED.student2Id } }))!.classroomId;

    await withRollback(async (tx) => {
      await tx.student.update({ where: { studentId: SEED.student2Id }, data: { classroomId: SEED.grade9C_2027 } });
      const s = await tx.student.findUnique({ where: { studentId: SEED.student2Id } });
      expect(s?.classroomId).toBe(SEED.grade9C_2027); // changed inside tx
    });

    const after = await db.student.findUnique({ where: { studentId: SEED.student2Id } });
    expect(after?.classroomId).toBe(orig); // restored after rollback
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E. BackupService.create — reads all 31 tables from real DB
// ═══════════════════════════════════════════════════════════════════════════════

describe('E. BackupService.create — real reads via project PrismaClient', () => {
  /**
   * BackupService.create() calls delegateFor(prisma, model).findMany() on the
   * imported prisma singleton (not the test client). We patch fs to capture
   * the written JSON without touching disk.
   */
  it('reads all 31 MODELS_IN_INSERT_ORDER tables and produces valid JSON backup', async () => {
    let capturedJson: string | null = null;

    const fsModule = await import('fs/promises');
    const fs = fsModule.default;
    const origMkdir     = fs.mkdir.bind(fs);
    const origWriteFile = fs.writeFile.bind(fs);
    const origStat      = fs.stat.bind(fs);

    (fs as Record<string, unknown>).mkdir     = async () => undefined;
    (fs as Record<string, unknown>).writeFile = async (_p: unknown, data: unknown) => { capturedJson = data as string; };
    (fs as Record<string, unknown>).stat      = async () => ({ size: 12345, mtime: new Date() });

    const EXPECTED_TABLES = [
      'role','user','administrator','director','viceDirector','teacher',
      'subject','classroom','teacherSubject','student','parent',
      'studentParentLink','studentEnrollment','userPermission','attendance',
      'gradeComponent','gradeEntry','gradeSubjectConfig','subjectFinalization',
      'classroomFinalization','academicReport','studentConduct','disciplineRecord',
      'notification','timetableEntry','assignment','assignmentSubmission',
      'promotionBatch','promotionEntry','studentIdCounter','systemSetting',
    ];

    try {
      const svc = new BackupService();
      const dto = await svc.create(ADMIN);

      expect(dto.fileName).toMatch(/^backup-\d{8}-\d{6}\.json$/);
      expect(dto.sizeBytes).toBe(12345);
      expect(typeof dto.createdAt).toBe('string');

      expect(capturedJson).not.toBeNull();
      const payload = JSON.parse(capturedJson!);
      expect(payload.version).toBe(1);
      expect(typeof payload.data).toBe('object');

      // All 31 tables present
      for (const t of EXPECTED_TABLES) {
        expect(payload.data, `Table "${t}" missing from backup`).toHaveProperty(t);
        expect(Array.isArray(payload.data[t])).toBe(true);
      }

      // Spot-check with real counts
      const realRoleCount = await db.role.count();
      expect(payload.data.role).toHaveLength(realRoleCount);

      const realUserCount = await db.user.count();
      expect(payload.data.user).toHaveLength(realUserCount);

      const realStudentCount = await db.student.count();
      expect(payload.data.student).toHaveLength(realStudentCount);
    } finally {
      (fs as Record<string, unknown>).mkdir     = origMkdir;
      (fs as Record<string, unknown>).writeFile = origWriteFile;
      (fs as Record<string, unknown>).stat      = origStat;
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// F. BackupService.saveUploaded — payload validation (pure logic, no DB)
// ═══════════════════════════════════════════════════════════════════════════════

describe('F. BackupService.saveUploaded — payload validation', () => {
  const ALL_TABLES = [
    'role','user','administrator','director','viceDirector','teacher',
    'subject','classroom','teacherSubject','student','parent',
    'studentParentLink','studentEnrollment','userPermission','attendance',
    'gradeComponent','gradeEntry','gradeSubjectConfig','subjectFinalization',
    'classroomFinalization','academicReport','studentConduct','disciplineRecord',
    'notification','timetableEntry','assignment','assignmentSubmission',
    'promotionBatch','promotionEntry','studentIdCounter','systemSetting',
  ];

  function validBuf(): Buffer {
    const data: Record<string, unknown[]> = {};
    for (const t of ALL_TABLES) data[t] = [];
    return Buffer.from(JSON.stringify({ version: 1, createdAt: new Date().toISOString(), data }));
  }

  it('rejects non-JSON buffer with 400', async () => {
    const svc = new BackupService();
    await expect(svc.saveUploaded(Buffer.from('not json'), ADMIN)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects wrong version with 400', async () => {
    const svc = new BackupService();
    const data: Record<string, unknown[]> = {};
    for (const t of ALL_TABLES) data[t] = [];
    const buf = Buffer.from(JSON.stringify({ version: 999, createdAt: new Date().toISOString(), data }));
    await expect(svc.saveUploaded(buf, ADMIN)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects payload missing a required table with 400', async () => {
    const svc = new BackupService();
    const data: Record<string, unknown[]> = {};
    for (const t of ALL_TABLES.filter(x => x !== 'role')) data[t] = [];
    const buf = Buffer.from(JSON.stringify({ version: 1, createdAt: new Date().toISOString(), data }));
    await expect(svc.saveUploaded(buf, ADMIN)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('accepts a valid payload and writes it to disk (fs patched)', async () => {
    let written = false;
    const fsModule = await import('fs/promises');
    const fs = fsModule.default;
    const orig = { mkdir: fs.mkdir.bind(fs), writeFile: fs.writeFile.bind(fs), stat: fs.stat.bind(fs) };

    (fs as Record<string, unknown>).mkdir     = async () => undefined;
    (fs as Record<string, unknown>).writeFile = async () => { written = true; };
    (fs as Record<string, unknown>).stat      = async () => ({ size: 256, mtime: new Date() });

    try {
      const svc = new BackupService();
      const dto = await svc.saveUploaded(validBuf(), ADMIN);
      expect(written).toBe(true);
      expect(dto.fileName).toMatch(/^backup-\d{8}-\d{6}\.json$/);
      expect(dto.sizeBytes).toBe(256);
    } finally {
      (fs as Record<string, unknown>).mkdir     = orig.mkdir;
      (fs as Record<string, unknown>).writeFile = orig.writeFile;
      (fs as Record<string, unknown>).stat      = orig.stat;
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// G. GradeComponent + GradeEntry real upsert
// ═══════════════════════════════════════════════════════════════════════════════

describe('G. GradeComponent creation + GradeEntry recording', () => {
  it('creates a component, records entries, and rolls back cleanly', async () => {
    const ts = await db.teacherSubject.findFirst({ where: { classroomId: SEED.grade9A } });
    if (!ts) { console.warn('No TeacherSubject in Grade 9A — skipping G'); return; }

    const students = await db.student.findMany({ where: { classroomId: SEED.grade9A }, select: { studentId: true }, take: 2 });
    if (students.length === 0) { console.warn('No students in Grade 9A — skipping G'); return; }

    let compId: number | null = null;

    await withRollback(async (tx) => {
      const comp = await tx.gradeComponent.create({
        data: { teacherSubjectId: ts.id, semester: 'SEMESTER_1', academicYear: '2026/27', category: 'QUIZ', name: `__gc_real_${Date.now()}__`, maxMarks: 20 },
      });
      compId = comp.gradeComponentId;

      for (const s of students) {
        await tx.gradeEntry.upsert({
          where:  { gradeComponentId_studentId: { gradeComponentId: comp.gradeComponentId, studentId: s.studentId } },
          create: { gradeComponentId: comp.gradeComponentId, studentId: s.studentId, score: 15 },
          update: { score: 15 },
        });
      }

      const entries = await tx.gradeEntry.findMany({ where: { gradeComponentId: comp.gradeComponentId } });
      expect(entries.length).toBe(students.length);
      for (const e of entries) expect(Number(e.score)).toBeLessThanOrEqual(Number(comp.maxMarks));
    });

    // After rollback: component and entries gone
    if (compId) {
      expect(await db.gradeComponent.findUnique({ where: { gradeComponentId: compId } })).toBeNull();
      expect(await db.gradeEntry.findMany({ where: { gradeComponentId: compId } })).toHaveLength(0);
    }
  });

  it('duplicate (tsId, semester, year, name) is rejected by DB unique constraint', async () => {
    const ts = await db.teacherSubject.findFirst();
    if (!ts) { console.warn('No TeacherSubject — skipping'); return; }

    const name = `__gc_dup_${Date.now()}__`;
    const comp = await db.gradeComponent.create({
      data: { teacherSubjectId: ts.id, semester: 'SEMESTER_1', academicYear: '2026/27', category: 'QUIZ', name, maxMarks: 10 },
    });
    try {
      await expect(
        db.gradeComponent.create({ data: { teacherSubjectId: ts.id, semester: 'SEMESTER_1', academicYear: '2026/27', category: 'QUIZ', name, maxMarks: 10 } })
      ).rejects.toThrow();
    } finally {
      await db.gradeComponent.deleteMany({ where: { gradeComponentId: comp.gradeComponentId } }).catch(() => {});
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// H. Attendance write + rollback isolation
// ═══════════════════════════════════════════════════════════════════════════════

describe('H. Attendance write isolation', () => {
  // Use a historical date and period=99 to avoid colliding with real data
  const TEST_DATE   = new Date('2020-01-01T00:00:00.000Z');
  const TEST_PERIOD = 99;

  it('attendance rows inserted inside a rolled-back tx leave no trace', async () => {
    const students = await db.student.findMany({ where: { classroomId: SEED.grade9A }, select: { studentId: true }, take: 2 });
    if (students.length === 0) { console.warn('No students — skipping H'); return; }

    const before = await db.attendance.count({ where: { classroomId: SEED.grade9A, attendanceDate: TEST_DATE, period: TEST_PERIOD } });

    await withRollback(async (tx) => {
      for (const s of students) {
        await tx.attendance.upsert({
          where:  { studentId_attendanceDate_period: { studentId: s.studentId, attendanceDate: TEST_DATE, period: TEST_PERIOD } },
          create: { studentId: s.studentId, teacherId: SEED.teacher1Id, classroomId: SEED.grade9A, attendanceDate: TEST_DATE, period: TEST_PERIOD, status: 'PRESENT' },
          update: { status: 'PRESENT' },
        });
      }
      const during = await tx.attendance.count({ where: { classroomId: SEED.grade9A, attendanceDate: TEST_DATE, period: TEST_PERIOD } });
      expect(during).toBeGreaterThanOrEqual(students.length);
    });

    const after = await db.attendance.count({ where: { classroomId: SEED.grade9A, attendanceDate: TEST_DATE, period: TEST_PERIOD } });
    expect(after).toBe(before); // rolled back — exactly as before
    expect(after).toBe(0);
  });

  it('committed attendance record is readable and cleans up properly', async () => {
    const student = await db.student.findFirst({ where: { classroomId: SEED.grade9A } });
    if (!student) { console.warn('No student — skipping H commit test'); return; }

    const date   = new Date('2020-01-02T00:00:00.000Z');
    const period = 88;

    try {
      await db.attendance.upsert({
        where:  { studentId_attendanceDate_period: { studentId: student.studentId, attendanceDate: date, period } },
        create: { studentId: student.studentId, teacherId: SEED.teacher1Id, classroomId: SEED.grade9A, attendanceDate: date, period, status: 'ABSENT' },
        update: { status: 'ABSENT' },
      });

      const found = await db.attendance.findUnique({ where: { studentId_attendanceDate_period: { studentId: student.studentId, attendanceDate: date, period } } });
      expect(found).not.toBeNull();
      expect(found?.status).toBe('ABSENT');
    } finally {
      await db.attendance.deleteMany({ where: { studentId: student.studentId, attendanceDate: date, period } }).catch(() => {});
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// I. Concurrent $transaction — StudentIdCounter race condition
// ═══════════════════════════════════════════════════════════════════════════════

describe('I. Concurrent StudentIdCounter — no duplicate admission numbers', () => {
  /**
   * Two PrismaClient instances simulate two simultaneous "create student"
   * requests. InnoDB row-level locking on the StudentIdCounter UPDATE ensures
   * they serialize and produce unique sequence numbers.
   */
  it('10 concurrent counter increments produce 10 unique, sequential numbers', async () => {
    // Build a second client for the competing connection
    const url = new URL(
      process.env.DATABASE_URL ?? 'mysql://dsssms_user:mudasir@localhost:3306/dsssms_db'
    );
    const adapter2 = new PrismaMariaDb({
      host: url.hostname, port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      connectionLimit: 10, allowPublicKeyRetrieval: true,
    });
    const db2 = new PrismaClient({ adapter: adapter2 });

    const before = (await db.studentIdCounter.findUnique({ where: { year: SEED.counterYear } }))?.lastSequence ?? 0;
    const acquiredSeqs: number[] = [];
    const userIds: number[] = [];
    const role = await db.role.findUnique({ where: { roleName: 'STUDENT' } });

    try {
      // Fire 10 concurrent transactions — each increments the counter and creates a user
      const tasks = Array.from({ length: 10 }, (_, i) =>
        db2.$transaction(async (tx) => {
          const counter = await tx.studentIdCounter.update({
            where: { year: SEED.counterYear },
            data:  { lastSequence: { increment: 1 } },
          });
          const seq = counter.lastSequence;
          const user = await tx.user.create({
            data: {
              username:           `DSH-CONC-${seq}-${Date.now()}-${i}`,
              passwordHash:       'x',
              roleId:             role!.roleId,
              status:             'ACTIVE',
              isTemporaryPassword: true,
              updatedAt:          new Date(),
            },
          });
          return { seq, userId: user.userId };
        })
      );

      const results = await Promise.all(tasks);
      acquiredSeqs.push(...results.map(r => r.seq));
      userIds.push(...results.map(r => r.userId));

      // All 10 sequences must be unique
      const unique = new Set(acquiredSeqs);
      expect(unique.size).toBe(10);

      // They must form a contiguous range of 10 values
      const sorted = [...acquiredSeqs].sort((a, b) => a - b);
      expect(sorted[9] - sorted[0]).toBe(9); // span exactly 9 apart

      // Final counter value must be before+10
      const after = await db.studentIdCounter.findUnique({ where: { year: SEED.counterYear } });
      expect(after?.lastSequence).toBe(before + 10);
    } finally {
      // Clean up users and restore counter
      for (const uid of userIds) {
        await db.user.deleteMany({ where: { userId: uid } }).catch(() => {});
      }
      await db.studentIdCounter.update({
        where: { year: SEED.counterYear },
        data:  { lastSequence: before },
      });
      await db2.$disconnect();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// J. POST /students — full HTTP round-trip with real DB
// ═══════════════════════════════════════════════════════════════════════════════

describe('J. POST /students — full HTTP + real DB round-trip', () => {
  /**
   * Calls the real Express app (createApp()) with a real Director JWT.
   * The Prisma singleton inside the app is the real production client connected
   * to dsssms_db. Every side-effect is cleaned up in finally.
   *
   * This test validates the full flow:
   *   JWT auth → RBAC → Zod validation → StudentService.createStudent
   *   → $transaction(StudentIdCounter.update + user.create + student.create)
   *   → 201 response with credentials
   */
  it('creates a student via HTTP, persists to real DB, returns 201 with credentials', async () => {
    // Import here — avoids circular issues in non-realdb suite
    const { createApp } = await import('../../app');
    const { signAccessToken } = await import('../../core/utils/jwt.util');
    const request = (await import('supertest')).default;

    const app = createApp();

    const directorToken = signAccessToken({
      sub: SEED.directorUserId, role: 'DIRECTOR', username: 'director.demo',
    });

    const seqBefore = (await db.studentIdCounter.findUnique({ where: { year: SEED.counterYear } }))?.lastSequence ?? 0;
    const usersBefore = await db.user.count();
    const studentsBefore = await db.student.count();

    let createdAdmissionNumber: string | null = null;

    try {
      const r = await request(app)
        .post('/api/v1/students')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          firstName:     'RealDB',
          lastName:      'HTTPTest',
          gender:        'F',
          dateOfBirth:   '2010-03-20',
          classroomId:   SEED.grade9A,
          admissionType: 'NEW_STUDENT',
        });

      expect(r.status).toBe(201);
      expect(r.body.success).toBe(true);

      // Response must contain credentials
      expect(r.body.data.credentials.username).toMatch(/^DSH-\d{4}-\d{5}$/);
      expect(r.body.data.credentials.temporaryPassword).toBeDefined();
      expect(typeof r.body.data.credentials.temporaryPassword).toBe('string');
      expect(r.body.data.credentials.temporaryPassword.length).toBeGreaterThan(6);

      createdAdmissionNumber = r.body.data.credentials.username;

      // Student must exist in the real DB
      const student = await db.student.findFirst({
        where: { admissionNumber: createdAdmissionNumber! },
        include: { user: true },
      });
      expect(student).not.toBeNull();
      expect(student!.firstName).toBe('RealDB');
      expect(student!.lastName).toBe('HTTPTest');
      expect(student!.classroomId).toBe(SEED.grade9A);

      // Counter incremented by exactly 1
      const seqAfter = (await db.studentIdCounter.findUnique({ where: { year: SEED.counterYear } }))?.lastSequence;
      expect(seqAfter).toBe(seqBefore + 1);

      // One more user and one more student
      expect(await db.user.count()).toBe(usersBefore + 1);
      expect(await db.student.count()).toBe(studentsBefore + 1);
    } finally {
      if (createdAdmissionNumber) {
        // Clean up: delete student then user (FK order)
        const s = await db.student.findFirst({ where: { admissionNumber: createdAdmissionNumber } }).catch(() => null);
        if (s) await db.student.deleteMany({ where: { studentId: s.studentId } }).catch(() => {});
        const u = await db.user.findFirst({ where: { username: createdAdmissionNumber } }).catch(() => null);
        if (u) await db.user.deleteMany({ where: { userId: u.userId } }).catch(() => {});
        // Restore counter
        await db.studentIdCounter.update({
          where: { year: SEED.counterYear },
          data:  { lastSequence: seqBefore },
        }).catch(() => {});
      }
    }
  });

  it('missing required field returns 422 without touching the DB', async () => {
    const { createApp } = await import('../../app');
    const { signAccessToken } = await import('../../core/utils/jwt.util');
    const request = (await import('supertest')).default;

    const app = createApp();
    const directorToken = signAccessToken({ sub: SEED.directorUserId, role: 'DIRECTOR', username: 'director.demo' });

    const seqBefore = (await db.studentIdCounter.findUnique({ where: { year: SEED.counterYear } }))?.lastSequence ?? 0;

    const r = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ lastName: 'Test', gender: 'M', dateOfBirth: '2010-01-01', classroomId: SEED.grade9A });
    // missing firstName → 422
    expect(r.status).toBe(422);
    expect(r.body.errorCode).toBe('VALIDATION_ERROR');

    // Counter untouched
    const seqAfter = (await db.studentIdCounter.findUnique({ where: { year: SEED.counterYear } }))?.lastSequence ?? 0;
    expect(seqAfter).toBe(seqBefore);
  });
});
