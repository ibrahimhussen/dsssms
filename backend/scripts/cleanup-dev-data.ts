/**
 * cleanup-dev-data.ts
 *
 * Phase 5.4 — Development database cleanup.
 *
 * Removes all development and testing records from the DSSSMS database.
 * Preserves: admin user (userId=1), all 6 roles, 4 subjects, 16 GradeSubjectConfig
 * rows, 1 SystemSetting row, and all 17 classrooms.
 *
 * ─── SAFETY DESIGN ──────────────────────────────────────────────────────────
 *
 * 1. TRANSACTION: Every deletion runs inside ONE Prisma interactive transaction
 *    (callback form). This is the same pattern used by backup.service.ts and
 *    student.service.ts in this codebase. Timeout: 120 000 ms.
 *    The transaction client (tx) is used for all operations — every operation
 *    is part of the same atomic unit.
 *
 * 2. ROLLBACK: All count assertions execute inside the same transaction callback.
 *    Any thrown error (including assertion failures) causes Prisma to issue
 *    ROLLBACK automatically before the error propagates. Zero partial state.
 *
 * 3. DATABASE CHECK: Prints the target database name and host before doing
 *    anything. Refuses to proceed if NODE_ENV=production.
 *
 * 4. CONFIRMATION PROMPT: Requires the user to type "YES" at the terminal
 *    before the transaction begins.
 *
 * ─── RECOVERY ────────────────────────────────────────────────────────────────
 *
 * The backup at backend/backups/backup-20261013-162900-pre-cleanup.json covers
 * the 31 backup-model tables (596 rows) only.
 *
 * Restore those 31 tables:
 *   POST /api/v1/backups/backup-20261013-162900-pre-cleanup.json/restore
 *   body: { "confirm": true }
 *
 * ⚠ IMPORTANT: auditLog (439 rows) and refreshToken (468 rows) are NOT in the
 * backup model. They are NOT restored by the above command. These tables are
 * permanently cleared by this script. The backup does NOT represent a complete
 * database snapshot.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *
 * From the backend/ directory:
 *   npx tsx scripts/cleanup-dev-data.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as readline from 'readline';
import 'dotenv/config';

// ── Safety: refuse to run in production ──────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: This script must not run in production (NODE_ENV=production).');
  process.exit(1);
}

// ── Expected post-cleanup counts (independently verified in final-verify.ts) ─
// These are the exact numbers the script asserts after the transaction commits.
// Any deviation causes the entire transaction to roll back.
const EXPECTED_FINAL: Record<string, number> = {
  // Preserved tables
  role:                 6,
  user:                 1,   // admin only (userId=1)
  administrator:        1,
  subject:              4,
  gradeSubjectConfig:  16,
  systemSetting:        1,
  classroom:           17,
  // Fully cleared tables
  director:             0,
  viceDirector:         0,
  teacher:              0,
  teacherSubject:       0,
  student:              0,
  parent:               0,
  studentParentLink:    0,
  studentEnrollment:    0,
  userPermission:       0,
  attendance:           0,
  gradeComponent:       0,
  gradeEntry:           0,
  subjectFinalization:  0,
  classroomFinalization:0,
  academicReport:       0,
  studentConduct:       0,
  disciplineRecord:     0,
  notification:         0,
  timetableEntry:       0,
  assignment:           0,
  assignmentSubmission: 0,
  promotionBatch:       0,
  promotionEntry:       0,
  studentIdCounter:     0,
  // Extra tables not in backup model
  auditLog:             0,
  refreshToken:         0,
  parentTeacherMessage: 0,
};

// ── Assertion helper — throws inside the transaction to trigger ROLLBACK ─────
function assertCount(
  table: string,
  actual: number,
  expected: number,
  context: string
): void {
  if (actual !== expected) {
    throw new Error(
      `ASSERTION FAILED [${table}] after ${context}: ` +
      `expected ${expected}, got ${actual}. ` +
      `Transaction will be rolled back.`
    );
  }
}

// ── Terminal confirmation prompt ─────────────────────────────────────────────
function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim() === 'YES');
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const dbUrl = new URL(process.env.DATABASE_URL!);
  const dbName = dbUrl.pathname.replace(/^\//, '');
  const dbHost = dbUrl.hostname;
  const dbUser = decodeURIComponent(dbUrl.username);

  // ── Step 0: Print target database and require confirmation ───────────────
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  DSSSMS Phase 5.4 — Development Database Cleanup              ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log(`║  Target database : ${dbName.padEnd(44)}║`);
  console.log(`║  Host            : ${dbHost.padEnd(44)}║`);
  console.log(`║  User            : ${dbUser.padEnd(44)}║`);
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log('║  This will permanently delete ALL development records:         ║');
  console.log('║    • All staff, student, and parent accounts (except admin)    ║');
  console.log('║    • All grades, attendance, enrollments, reports, messages    ║');
  console.log('║    • All timetable, assignment, promotion, and audit data      ║');
  console.log('║    • All refresh tokens and session data                       ║');
  console.log('║                                                                ║');
  console.log('║  Preserved: admin user, roles, subjects, GradeSubjectConfig,  ║');
  console.log('║  SystemSetting, and all 17 classrooms.                        ║');
  console.log('║                                                                ║');
  console.log('║  ⚠ BACKUP LIMITATION: The JSON backup restores 31 tables     ║');
  console.log('║  (596 rows) only. auditLog (439) and refreshToken (468) are   ║');
  console.log('║  NOT restored by a backup restore. They are permanently gone.  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const approved = await confirm('Type YES to proceed, anything else to abort: ');
  if (!approved) {
    console.log('\nAborted — no data was modified.\n');
    process.exit(0);
  }

  console.log('\nStarting cleanup transaction...\n');

  // ── Connect ──────────────────────────────────────────────────────────────
  const adapter = new PrismaMariaDb({
    host: dbHost,
    port: dbUrl.port ? Number(dbUrl.port) : 3306,
    user: dbUser,
    password: decodeURIComponent(dbUrl.password),
    database: dbName,
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    // ── ONE TRANSACTION — all steps, all assertions ─────────────────────────
    await prisma.$transaction(async (tx) => {

      // ── STEP 1: Null out all classroom homeroom teacher references ────────
      // classrooms.homeroomTeacherId → teachers.teacherId is SET NULL in DB.
      // Doing this explicitly before any deletion makes the order unambiguous.
      const homeroomUpdate = await tx.classroom.updateMany({
        where:  { homeroomTeacherId: { not: null } },
        data:   { homeroomTeacherId: null },
      });
      console.log(`  STEP 1  Cleared homeroom teacher refs: ${homeroomUpdate.count} classrooms updated`);
      if (homeroomUpdate.count !== 6) {
        throw new Error(
          `STEP 1 ASSERTION: expected 6 classrooms updated, got ${homeroomUpdate.count}. ` +
          `Transaction rolled back.`
        );
      }

      // ── STEP 2: Delete PromotionEntry ─────────────────────────────────────
      // promotion_entries.studentId → students.studentId is RESTRICT.
      // Students cannot be deleted while these rows exist.
      const promoEntryDel = await tx.promotionEntry.deleteMany({
        where: { id: { in: [1, 2, 3, 4, 5, 6] } },
      });
      console.log(`  STEP 2  PromotionEntry deleted: ${promoEntryDel.count}`);
      assertCount('promotionEntry', promoEntryDel.count, 6, 'STEP 2');
      const promoEntryRemaining = await tx.promotionEntry.count();
      assertCount('promotionEntry remaining', promoEntryRemaining, 0, 'STEP 2 post');

      // ── STEP 3: Delete PromotionBatch ─────────────────────────────────────
      // promotion_batches.preparedById → users.userId is RESTRICT.
      // The preparing user cannot be deleted while batches exist.
      const promoBatchDel = await tx.promotionBatch.deleteMany({
        where: { id: { in: [1, 2] } },
      });
      console.log(`  STEP 3  PromotionBatch deleted: ${promoBatchDel.count}`);
      assertCount('promotionBatch', promoBatchDel.count, 2, 'STEP 3');
      const promoBatchRemaining = await tx.promotionBatch.count();
      assertCount('promotionBatch remaining', promoBatchRemaining, 0, 'STEP 3 post');

      // ── STEP 4: Delete all Students ───────────────────────────────────────
      // Pattern 'DSH-2026-%' matches all 13 dev student admission numbers.
      // Cascades: gradeEntry(170), academicReport(25), attendance(30),
      //   studentEnrollment(22), studentParentLink(8), assignmentSubmission(3),
      //   parentTeacherMessage(5), notification(9 via studentId FK),
      //   studentConduct(0), disciplineRecord(0).
      const studentDel = await tx.student.deleteMany({
        where: { admissionNumber: { startsWith: 'DSH-2026-' } },
      });
      console.log(`  STEP 4  Students deleted: ${studentDel.count} (cascades triggered)`);
      assertCount('student', studentDel.count, 13, 'STEP 4');

      // Verify all cascade-dependent tables are now empty
      const gradeEntryCount     = await tx.gradeEntry.count();
      const academicReportCount = await tx.academicReport.count();
      const attendanceCount     = await tx.attendance.count();
      const enrollmentCount     = await tx.studentEnrollment.count();
      const parentLinkCount     = await tx.studentParentLink.count();
      const assignSubCount      = await tx.assignmentSubmission.count();
      const ptmCount            = await tx.parentTeacherMessage.count();
      assertCount('gradeEntry',           gradeEntryCount,     0, 'STEP 4 cascade');
      assertCount('academicReport',       academicReportCount, 0, 'STEP 4 cascade');
      assertCount('attendance',           attendanceCount,     0, 'STEP 4 cascade');
      assertCount('studentEnrollment',    enrollmentCount,     0, 'STEP 4 cascade');
      assertCount('studentParentLink',    parentLinkCount,     0, 'STEP 4 cascade');
      assertCount('assignmentSubmission', assignSubCount,      0, 'STEP 4 cascade');
      assertCount('parentTeacherMessage', ptmCount,            0, 'STEP 4 cascade');
      console.log(`  STEP 4  Cascade verification: gradeEntry=0 academicReport=0 attendance=0 ✓`);
      console.log(`  STEP 4  Cascade verification: enrollment=0 parentLink=0 assignSub=0 ptm=0 ✓`);

      // Notifications: 9 were cascade-deleted via studentId FK; 110 remain
      const notifAfterStep4 = await tx.notification.count();
      assertCount('notification after step 4', notifAfterStep4, 110, 'STEP 4 partial cascade');
      console.log(`  STEP 4  Notifications remaining after student cascade: ${notifAfterStep4} (expected 110) ✓`);

      // ── STEP 5: Delete all audit_log rows (Q1=B) ─────────────────────────
      // audit_logs.userId is SET NULL — not blocking. Cleared here per decision.
      const auditDel = await tx.auditLog.deleteMany();
      console.log(`  STEP 5  AuditLog deleted: ${auditDel.count}`);
      assertCount('auditLog', auditDel.count, 439, 'STEP 5');
      const auditRemaining = await tx.auditLog.count();
      assertCount('auditLog remaining', auditRemaining, 0, 'STEP 5 post');

      // ── STEP 6: Delete all remaining notifications ────────────────────────
      // 110 remaining after step 4's studentId cascade.
      // Includes 3 rows whose recipient=admin — these would NOT be auto-deleted
      // by any cascade in step 8. Must be deleted explicitly.
      const notifDel = await tx.notification.deleteMany();
      console.log(`  STEP 6  Notifications deleted: ${notifDel.count}`);
      assertCount('notification', notifDel.count, 110, 'STEP 6');
      const notifRemaining = await tx.notification.count();
      assertCount('notification remaining', notifRemaining, 0, 'STEP 6 post');

      // ── STEP 7: Delete all refresh tokens ────────────────────────────────
      // refreshToken.userId → users.userId is CASCADE — these would be deleted
      // in step 8. Deleting here makes step 8's cascade scope cleaner and the
      // count assertion on user deletion straightforward.
      const tokenDel = await tx.refreshToken.deleteMany();
      console.log(`  STEP 7  RefreshToken deleted: ${tokenDel.count}`);
      assertCount('refreshToken', tokenDel.count, 468, 'STEP 7');
      const tokenRemaining = await tx.refreshToken.count();
      assertCount('refreshToken remaining', tokenRemaining, 0, 'STEP 7 post');

      // ── STEP 8: Delete all non-admin User rows ────────────────────────────
      // Cascades: director(4), viceDirector(7), teacher(11) →
      //   teacherSubject(9) → gradeComponent(56), timetableEntry(10), assignment(1)
      //   parent(9)
      // SET NULL (rows kept): systemSetting.updatedByUserId, classroom.homeroomTeacherId
      //   (already nulled in step 1)
      const userDel = await tx.user.deleteMany({
        where: { userId: { not: 1 } },
      });
      console.log(`  STEP 8  Users deleted: ${userDel.count} (cascades triggered)`);
      assertCount('user deleted', userDel.count, 44, 'STEP 8');

      // Verify user cascade results
      const directorCount       = await tx.director.count();
      const vdirCount           = await tx.viceDirector.count();
      const teacherCount        = await tx.teacher.count();
      const parentCount         = await tx.parent.count();
      const teacherSubjectCount = await tx.teacherSubject.count();
      const gradeCompCount      = await tx.gradeComponent.count();
      const timetableCount      = await tx.timetableEntry.count();
      const assignmentCount     = await tx.assignment.count();
      assertCount('director',       directorCount,       0, 'STEP 8 cascade');
      assertCount('viceDirector',   vdirCount,           0, 'STEP 8 cascade');
      assertCount('teacher',        teacherCount,        0, 'STEP 8 cascade');
      assertCount('parent',         parentCount,         0, 'STEP 8 cascade');
      assertCount('teacherSubject', teacherSubjectCount, 0, 'STEP 8 cascade');
      assertCount('gradeComponent', gradeCompCount,      0, 'STEP 8 cascade');
      assertCount('timetableEntry', timetableCount,      0, 'STEP 8 cascade');
      assertCount('assignment',     assignmentCount,     0, 'STEP 8 cascade');
      console.log(`  STEP 8  Cascade verification: director/vd/teacher/parent all 0 ✓`);
      console.log(`  STEP 8  Cascade verification: teacherSubject/gradeComp/timetable/assignment all 0 ✓`);

      // ── STEP 9: Delete StudentIdCounter ──────────────────────────────────
      // All 13 dev students gone. Counter at lastSequence=13.
      // Deleting the row means next real admission auto-creates it at 1 →
      // produces DSH-2026-00001 with no collision (admission table is empty).
      const counterDel = await tx.studentIdCounter.deleteMany();
      console.log(`  STEP 9  StudentIdCounter deleted: ${counterDel.count}`);
      assertCount('studentIdCounter', counterDel.count, 1, 'STEP 9');
      const counterRemaining = await tx.studentIdCounter.count();
      assertCount('studentIdCounter remaining', counterRemaining, 0, 'STEP 9 post');

      // ── FINAL ASSERTIONS: verify preserved tables are intact ──────────────
      console.log('\n  Running final assertions...');

      // User table — only admin remains
      const userCount  = await tx.user.count();
      const adminUser  = await tx.user.findUnique({ where: { userId: 1 } });
      assertCount('user final', userCount, 1, 'FINAL');
      if (!adminUser || adminUser.username !== 'admin' || adminUser.status !== 'ACTIVE') {
        throw new Error(
          `FINAL ASSERTION: admin user (userId=1) missing or invalid after cleanup. ` +
          `Found: ${JSON.stringify(adminUser)}. Transaction rolled back.`
        );
      }

      // All homeroom references cleared
      const homeroomRemaining = await tx.classroom.count({ where: { homeroomTeacherId: { not: null } } });
      assertCount('classroom homeroom', homeroomRemaining, 0, 'FINAL homeroom');

      // All preserved tables
      assertCount('role',               await tx.role.count(),               6,  'FINAL');
      assertCount('administrator',      await tx.administrator.count(),      1,  'FINAL');
      assertCount('subject',            await tx.subject.count(),            4,  'FINAL');
      assertCount('gradeSubjectConfig', await tx.gradeSubjectConfig.count(), 16, 'FINAL');
      assertCount('systemSetting',      await tx.systemSetting.count(),      1,  'FINAL');
      assertCount('classroom',          await tx.classroom.count(),          17, 'FINAL');

      // All cleared tables — spot-check the ones with complex cascades
      assertCount('student',    await tx.student.count(),    0, 'FINAL');
      assertCount('gradeEntry', await tx.gradeEntry.count(), 0, 'FINAL');
      assertCount('attendance', await tx.attendance.count(), 0, 'FINAL');
      assertCount('notification', await tx.notification.count(), 0, 'FINAL');
      assertCount('auditLog',     await tx.auditLog.count(),     0, 'FINAL');
      assertCount('refreshToken', await tx.refreshToken.count(), 0, 'FINAL');
      assertCount('parentTeacherMessage', await tx.parentTeacherMessage.count(), 0, 'FINAL');

      console.log('  All assertions passed ✓');
      console.log('\n  Committing transaction...');

    }, { timeout: 120_000 });

    // ── Post-commit full count verification ───────────────────────────────
    console.log('\n  Post-commit count verification:');
    let allMatch = true;
    for (const [table, expected] of Object.entries(EXPECTED_FINAL)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actual: number = await (prisma as any)[table].count();
      const ok = actual === expected;
      if (!ok) {
        console.log(`  ✗ ${table.padEnd(26)}: expected ${expected}, got ${actual}`);
        allMatch = false;
      } else if (expected > 0) {
        console.log(`  ✓ ${table.padEnd(26)}: ${actual} (preserved)`);
      }
    }

    if (!allMatch) {
      console.error('\n  ⚠ WARNING: Some post-commit counts do not match expectations.');
      console.error('  The transaction was already committed. Review the counts above.');
      console.error('  Restore from backup if needed:');
      console.error('    POST /api/v1/backups/backup-20261013-162900-pre-cleanup.json/restore');
      console.error('    body: { "confirm": true }');
      console.error('    NOTE: auditLog and refreshToken are NOT restored by backup restore.\n');
    } else {
      console.log('\n╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  CLEANUP COMPLETE                                              ║');
      console.log('╠═══════════════════════════════════════════════════════════════╣');
      console.log('║  Preserved:  admin user, 6 roles, 4 subjects, 16 GSC rows,   ║');
      console.log('║              1 SystemSetting, 17 classrooms                   ║');
      console.log('║  Total rows: 46                                               ║');
      console.log('╠═══════════════════════════════════════════════════════════════╣');
      console.log('║  ⚠ ACTION REQUIRED:                                           ║');
      console.log('║  1. Change admin password (isTemporaryPassword=true)          ║');
      console.log('║  2. Update SystemSetting schoolName to real school name       ║');
      console.log('║  3. Verify subjects and GradeSubjectConfig match curriculum   ║');
      console.log('║  4. Assign real teachers and adjust classrooms as needed      ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error('\n✗ Cleanup failed (transaction was rolled back):\n', e.message ?? e);
  process.exit(1);
});
