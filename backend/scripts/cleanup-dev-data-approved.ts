/**
 * cleanup-dev-data-approved.ts
 *
 * Phase 5.4 — Approved execution wrapper.
 * Skips the interactive prompt (approval given explicitly by user).
 * Runs exactly the same transaction as cleanup-dev-data.ts.
 *
 * Approval received: "APPROVED — execute Phase 5.4 cleanup"
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: This script must not run in production (NODE_ENV=production).');
  process.exit(1);
}

const EXPECTED_FINAL: Record<string, number> = {
  role:6, user:1, administrator:1, subject:4, gradeSubjectConfig:16,
  systemSetting:1, classroom:17,
  director:0, viceDirector:0, teacher:0, teacherSubject:0, student:0,
  parent:0, studentParentLink:0, studentEnrollment:0, userPermission:0,
  attendance:0, gradeComponent:0, gradeEntry:0, subjectFinalization:0,
  classroomFinalization:0, academicReport:0, studentConduct:0,
  disciplineRecord:0, notification:0, timetableEntry:0, assignment:0,
  assignmentSubmission:0, promotionBatch:0, promotionEntry:0,
  studentIdCounter:0, auditLog:0, refreshToken:0, parentTeacherMessage:0,
};

function assertCount(table: string, actual: number, expected: number, context: string): void {
  if (actual !== expected) {
    throw new Error(
      `ASSERTION FAILED [${table}] after ${context}: expected ${expected}, got ${actual}. Transaction rolled back.`
    );
  }
}

async function main(): Promise<void> {
  const dbUrl  = new URL(process.env.DATABASE_URL!);
  const dbName = dbUrl.pathname.replace(/^\//, '');
  const dbHost = dbUrl.hostname;
  const dbUser = decodeURIComponent(dbUrl.username);

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  DSSSMS Phase 5.4 — Development Database Cleanup (APPROVED)   ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log(`║  Target database : ${dbName.padEnd(44)}║`);
  console.log(`║  Host            : ${dbHost.padEnd(44)}║`);
  console.log(`║  User            : ${dbUser.padEnd(44)}║`);
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log('║  Approval: "APPROVED — execute Phase 5.4 cleanup"             ║');
  console.log('║  ⚠ BACKUP LIMITATION: auditLog(439) and refreshToken(468)     ║');
  console.log('║  are NOT restored by backup restore — permanently cleared.    ║');
  console.log('║  Separate backup: backup-20261014-120550-excluded-tables.json ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const adapter = new PrismaMariaDb({
    host: dbHost, port: dbUrl.port ? Number(dbUrl.port) : 3306,
    user: dbUser, password: decodeURIComponent(dbUrl.password),
    database: dbName, connectionLimit: 5, allowPublicKeyRetrieval: true,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$transaction(async (tx) => {

      // STEP 1 — Clear homeroom teacher references
      const homeroomUpdate = await tx.classroom.updateMany({
        where: { homeroomTeacherId: { not: null } },
        data:  { homeroomTeacherId: null },
      });
      console.log(`  STEP 1  Cleared homeroom refs: ${homeroomUpdate.count} classrooms updated`);
      if (homeroomUpdate.count !== 6) {
        throw new Error(`STEP 1: expected 6 classrooms updated, got ${homeroomUpdate.count}. Rolled back.`);
      }

      // STEP 2 — Delete PromotionEntry
      const promoEntryDel = await tx.promotionEntry.deleteMany({ where: { id: { in: [1,2,3,4,5,6] } } });
      console.log(`  STEP 2  PromotionEntry deleted: ${promoEntryDel.count}`);
      assertCount('promotionEntry', promoEntryDel.count, 6, 'STEP 2');
      assertCount('promotionEntry remaining', await tx.promotionEntry.count(), 0, 'STEP 2 post');

      // STEP 3 — Delete PromotionBatch
      const promoBatchDel = await tx.promotionBatch.deleteMany({ where: { id: { in: [1,2] } } });
      console.log(`  STEP 3  PromotionBatch deleted: ${promoBatchDel.count}`);
      assertCount('promotionBatch', promoBatchDel.count, 2, 'STEP 3');
      assertCount('promotionBatch remaining', await tx.promotionBatch.count(), 0, 'STEP 3 post');

      // STEP 4 — Delete all Students (+ cascades)
      const studentDel = await tx.student.deleteMany({ where: { admissionNumber: { startsWith: 'DSH-2026-' } } });
      console.log(`  STEP 4  Students deleted: ${studentDel.count} (cascades triggered)`);
      assertCount('student', studentDel.count, 13, 'STEP 4');
      assertCount('gradeEntry',           await tx.gradeEntry.count(),           0, 'STEP 4 cascade');
      assertCount('academicReport',       await tx.academicReport.count(),       0, 'STEP 4 cascade');
      assertCount('attendance',           await tx.attendance.count(),           0, 'STEP 4 cascade');
      assertCount('studentEnrollment',    await tx.studentEnrollment.count(),    0, 'STEP 4 cascade');
      assertCount('studentParentLink',    await tx.studentParentLink.count(),    0, 'STEP 4 cascade');
      assertCount('assignmentSubmission', await tx.assignmentSubmission.count(), 0, 'STEP 4 cascade');
      assertCount('parentTeacherMessage', await tx.parentTeacherMessage.count(), 0, 'STEP 4 cascade');
      const notifAfterStep4 = await tx.notification.count();
      assertCount('notification after step 4', notifAfterStep4, 110, 'STEP 4 partial cascade');
      console.log(`  STEP 4  Cascade verification passed: all 7 cascade tables = 0 ✓`);
      console.log(`  STEP 4  Notifications remaining: ${notifAfterStep4} (expected 110) ✓`);

      // STEP 5 — Delete audit_log (Q1=B)
      const auditDel = await tx.auditLog.deleteMany();
      console.log(`  STEP 5  AuditLog deleted: ${auditDel.count}`);
      assertCount('auditLog', auditDel.count, 439, 'STEP 5');
      assertCount('auditLog remaining', await tx.auditLog.count(), 0, 'STEP 5 post');

      // STEP 6 — Delete all remaining notifications
      const notifDel = await tx.notification.deleteMany();
      console.log(`  STEP 6  Notifications deleted: ${notifDel.count}`);
      assertCount('notification', notifDel.count, 110, 'STEP 6');
      assertCount('notification remaining', await tx.notification.count(), 0, 'STEP 6 post');

      // STEP 7 — Delete all refresh tokens
      const tokenDel = await tx.refreshToken.deleteMany();
      console.log(`  STEP 7  RefreshToken deleted: ${tokenDel.count}`);
      assertCount('refreshToken', tokenDel.count, 468, 'STEP 7');
      assertCount('refreshToken remaining', await tx.refreshToken.count(), 0, 'STEP 7 post');

      // STEP 8 — Delete all non-admin users (+ cascades)
      const userDel = await tx.user.deleteMany({ where: { userId: { not: 1 } } });
      console.log(`  STEP 8  Users deleted: ${userDel.count} (cascades triggered)`);
      assertCount('user deleted', userDel.count, 44, 'STEP 8');
      assertCount('director',       await tx.director.count(),       0, 'STEP 8 cascade');
      assertCount('viceDirector',   await tx.viceDirector.count(),   0, 'STEP 8 cascade');
      assertCount('teacher',        await tx.teacher.count(),        0, 'STEP 8 cascade');
      assertCount('parent',         await tx.parent.count(),         0, 'STEP 8 cascade');
      assertCount('teacherSubject', await tx.teacherSubject.count(), 0, 'STEP 8 cascade');
      assertCount('gradeComponent', await tx.gradeComponent.count(), 0, 'STEP 8 cascade');
      assertCount('timetableEntry', await tx.timetableEntry.count(), 0, 'STEP 8 cascade');
      assertCount('assignment',     await tx.assignment.count(),     0, 'STEP 8 cascade');
      console.log(`  STEP 8  Cascade verification passed ✓`);

      // STEP 9 — Delete StudentIdCounter
      const counterDel = await tx.studentIdCounter.deleteMany();
      console.log(`  STEP 9  StudentIdCounter deleted: ${counterDel.count}`);
      assertCount('studentIdCounter', counterDel.count, 1, 'STEP 9');
      assertCount('studentIdCounter remaining', await tx.studentIdCounter.count(), 0, 'STEP 9 post');

      // FINAL ASSERTIONS — verify preserved records are intact
      console.log('\n  Running final assertions...');
      const userCount = await tx.user.count();
      const adminUser = await tx.user.findUnique({ where: { userId: 1 } });
      assertCount('user final', userCount, 1, 'FINAL');
      if (!adminUser || adminUser.username !== 'admin' || adminUser.status !== 'ACTIVE') {
        throw new Error(`FINAL: admin missing or invalid: ${JSON.stringify(adminUser)}. Rolled back.`);
      }
      assertCount('classroom homeroom', await tx.classroom.count({ where: { homeroomTeacherId: { not: null } } }), 0, 'FINAL homeroom');
      assertCount('role',               await tx.role.count(),               6,  'FINAL');
      assertCount('administrator',      await tx.administrator.count(),      1,  'FINAL');
      assertCount('subject',            await tx.subject.count(),            4,  'FINAL');
      assertCount('gradeSubjectConfig', await tx.gradeSubjectConfig.count(), 16, 'FINAL');
      assertCount('systemSetting',      await tx.systemSetting.count(),      1,  'FINAL');
      assertCount('classroom',          await tx.classroom.count(),          17, 'FINAL');
      assertCount('student',            await tx.student.count(),            0,  'FINAL');
      assertCount('gradeEntry',         await tx.gradeEntry.count(),         0,  'FINAL');
      assertCount('attendance',         await tx.attendance.count(),         0,  'FINAL');
      assertCount('notification',       await tx.notification.count(),       0,  'FINAL');
      assertCount('auditLog',           await tx.auditLog.count(),           0,  'FINAL');
      assertCount('refreshToken',       await tx.refreshToken.count(),       0,  'FINAL');
      assertCount('parentTeacherMessage', await tx.parentTeacherMessage.count(), 0, 'FINAL');
      console.log('  All final assertions passed ✓');
      console.log('\n  Committing transaction...');

    }, { timeout: 120_000 });

    // Post-commit full count verification
    console.log('\n  Post-commit count verification:');
    let allMatch = true;
    for (const [table, expected] of Object.entries(EXPECTED_FINAL)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actual: number = await (prisma as any)[table].count();
      const ok = actual === expected;
      if (!ok) { console.log(`  ✗ ${table.padEnd(26)}: expected ${expected}, got ${actual}`); allMatch = false; }
      else if (expected > 0) { console.log(`  ✓ ${table.padEnd(26)}: ${actual} (preserved)`); }
    }

    if (!allMatch) {
      console.error('\n  ⚠ Some post-commit counts do not match. Review above.');
      console.error('  Restore: POST /api/v1/backups/backup-20261013-162900-pre-cleanup.json/restore  body: { "confirm": true }');
      console.error('  NOTE: auditLog and refreshToken are NOT restored by backup restore.\n');
    } else {
      console.log('\n╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  CLEANUP COMPLETE                                              ║');
      console.log('╠═══════════════════════════════════════════════════════════════╣');
      console.log('║  Preserved : admin, 6 roles, 4 subjects, 16 GradeSubjectConfig║');
      console.log('║              1 SystemSetting, 17 classrooms                   ║');
      console.log('║  Total rows: 46                                               ║');
      console.log('╠═══════════════════════════════════════════════════════════════╣');
      console.log('║  ACTION REQUIRED before go-live:                              ║');
      console.log('║  1. Change admin password (isTemporaryPassword=true)          ║');
      console.log('║  2. Update SystemSetting schoolName to real school name       ║');
      console.log('║  3. Verify subjects and GradeSubjectConfig match curriculum   ║');
      console.log('║  4. Create real staff accounts and assign to classrooms       ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error('\n✗ Cleanup failed (transaction rolled back):\n', e.message ?? e);
  process.exit(1);
});
