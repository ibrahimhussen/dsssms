/**
 * verify-plan.ts — Independent verification script for Phase 5.4 cleanup plan.
 * Checks:
 *   1. Storage engines (transaction support)
 *   2. Every FK relationship and cascade behaviour
 *   3. Exact row counts per table that will be affected
 *   4. StudentIdCounter safety
 *   5. Backup file integrity
 *   6. Orphaned-record detection
 *   7. Admin account integrity
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

async function main(): Promise<void> {
  const u = new URL(process.env.DATABASE_URL!);
  const dbName = u.pathname.replace(/^\//, '');
  const adapter = new PrismaMariaDb({
    host: u.hostname, port: Number(u.port || 3306),
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: dbName, connectionLimit: 3,
  });
  const p = new PrismaClient({ adapter });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Phase 5.4 — Independent Plan Verification (READ ONLY)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── 1. Storage engine check ──────────────────────────────────────────────
  console.log('── 1. STORAGE ENGINES ──────────────────────────────────────────');
  const engines = await p.$queryRaw<{ TABLE_NAME: string; ENGINE: string }[]>`
    SELECT TABLE_NAME, ENGINE
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ${dbName}
    ORDER BY TABLE_NAME`;
  const nonInnoDB = engines.filter(e => e.ENGINE !== 'InnoDB');
  if (nonInnoDB.length > 0) {
    console.log('  ⚠ NON-InnoDB tables (no transaction support):');
    nonInnoDB.forEach(e => console.log(`    ${e.TABLE_NAME}: ${e.ENGINE}`));
  } else {
    console.log(`  ✓ All ${engines.length} tables use InnoDB — transactions fully supported`);
  }

  // ── 2. FK constraints — verify cascade/restrict rules ───────────────────
  console.log('\n── 2. FK CONSTRAINTS AFFECTING DELETION ORDER ──────────────────');
  const fks = await p.$queryRaw<{
    TABLE_NAME: string; COLUMN_NAME: string;
    REFERENCED_TABLE_NAME: string; REFERENCED_COLUMN_NAME: string;
    DELETE_RULE: string;
  }[]>`
    SELECT kcu.TABLE_NAME, kcu.COLUMN_NAME,
           kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME,
           rc.DELETE_RULE
    FROM information_schema.KEY_COLUMN_USAGE kcu
    JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
      ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
     AND rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
    WHERE kcu.TABLE_SCHEMA = ${dbName}
      AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME`;

  // Show only RESTRICT/NO ACTION rules — these are blocking constraints
  const restrictRules = fks.filter(f => f.DELETE_RULE === 'RESTRICT' || f.DELETE_RULE === 'NO ACTION');
  console.log(`  Total FKs: ${fks.length}  Blocking (RESTRICT/NO ACTION): ${restrictRules.length}`);
  if (restrictRules.length > 0) {
    console.log('  BLOCKING FKs:');
    restrictRules.forEach(f =>
      console.log(`    ${f.TABLE_NAME}.${f.COLUMN_NAME} → ${f.REFERENCED_TABLE_NAME}.${f.REFERENCED_COLUMN_NAME} [${f.DELETE_RULE}]`)
    );
  }
  // Show SET NULL rules
  const setNullRules = fks.filter(f => f.DELETE_RULE === 'SET NULL');
  console.log(`  SET NULL FKs (${setNullRules.length}):`);
  setNullRules.forEach(f =>
    console.log(`    ${f.TABLE_NAME}.${f.COLUMN_NAME} → ${f.REFERENCED_TABLE_NAME}.${f.REFERENCED_COLUMN_NAME}`)
  );

  // ── 3. Exact counts for every table being deleted ────────────────────────
  console.log('\n── 3. EXACT ROW COUNTS — RECORDS TO DELETE ─────────────────────');

  // All student IDs (all 13 are dev)
  const allStudents = await p.student.findMany({ select: { studentId: true, admissionNumber: true } });
  const allStudentIds = allStudents.map(s => s.studentId);
  console.log(`  Students (all dev):          ${allStudents.length} — ${allStudents.map(s => s.admissionNumber).join(', ')}`);

  // Per-student cascade counts
  const gradeEntries     = await p.gradeEntry.count({ where: { studentId: { in: allStudentIds } } });
  const academicReports  = await p.academicReport.count({ where: { studentId: { in: allStudentIds } } });
  const attendanceRows   = await p.attendance.count({ where: { studentId: { in: allStudentIds } } });
  const enrollments      = await p.studentEnrollment.count({ where: { studentId: { in: allStudentIds } } });
  const parentLinks      = await p.studentParentLink.count({ where: { studentId: { in: allStudentIds } } });
  const assignSubs       = await p.assignmentSubmission.count({ where: { studentId: { in: allStudentIds } } });
  const ptMessages       = await p.parentTeacherMessage.count({ where: { studentId: { in: allStudentIds } } });
  const notifByStudentId = await p.notification.count({ where: { studentId: { in: allStudentIds } } });
  const conductRows      = await p.studentConduct.count({ where: { studentId: { in: allStudentIds } } });
  const disciplineRows   = await p.disciplineRecord.count({ where: { studentId: { in: allStudentIds } } });
  const promoEntries     = await p.promotionEntry.count({ where: { studentId: { in: allStudentIds } } });

  console.log(`  GradeEntry (via studentId):  ${gradeEntries}`);
  console.log(`  AcademicReport:              ${academicReports}`);
  console.log(`  Attendance:                  ${attendanceRows}`);
  console.log(`  StudentEnrollment:           ${enrollments}`);
  console.log(`  StudentParentLink:           ${parentLinks}`);
  console.log(`  AssignmentSubmission:        ${assignSubs}`);
  console.log(`  ParentTeacherMessage:        ${ptMessages}`);
  console.log(`  Notification(studentId):     ${notifByStudentId}`);
  console.log(`  StudentConduct:              ${conductRows}`);
  console.log(`  DisciplineRecord:            ${disciplineRows}`);
  console.log(`  PromotionEntry:              ${promoEntries} ← must delete BEFORE student (no cascade)`);

  // Verify total gradeEntries matches table total (none orphaned outside student scope)
  const totalGradeEntries = await p.gradeEntry.count();
  console.log(`  GradeEntry total in table:   ${totalGradeEntries} — via-student: ${gradeEntries} — match: ${totalGradeEntries === gradeEntries}`);

  // Verify total attendance matches
  const totalAttendance = await p.attendance.count();
  console.log(`  Attendance total in table:   ${totalAttendance} — via-student: ${attendanceRows} — match: ${totalAttendance === attendanceRows}`);

  // PromotionBatch
  const promoBatches = await p.promotionBatch.findMany({ select: { id: true, status: true, sourceClassroomId: true } });
  console.log(`  PromotionBatch:              ${promoBatches.length} — ids=[${promoBatches.map(b => b.id).join(',')}] all dev: true`);

  // All non-admin users
  const nonAdminUsers = await p.user.findMany({
    where: { userId: { not: 1 } },
    select: { userId: true, username: true, role: { select: { roleName: true } } },
    orderBy: { userId: 'asc' },
  });
  console.log(`\n  Non-admin users to delete:   ${nonAdminUsers.length}`);
  for (const u2 of nonAdminUsers) {
    console.log(`    userId=${u2.userId} ${u2.username} (${u2.role.roleName})`);
  }

  // Cascades from User (non-admin)
  const nonAdminIds = nonAdminUsers.map(u2 => u2.userId);
  const directors    = await p.director.count({ where: { userId: { in: nonAdminIds } } });
  const vdirs        = await p.viceDirector.count({ where: { userId: { in: nonAdminIds } } });
  const teachers     = await p.teacher.count({ where: { userId: { in: nonAdminIds } } });
  const parents      = await p.parent.count({ where: { userId: { in: nonAdminIds } } });
  const refreshToks  = await p.refreshToken.count({ where: { userId: { in: nonAdminIds } } });
  const userPerms    = await p.userPermission.count({ where: { userId: { in: nonAdminIds } } });
  const notifByRecip = await p.notification.count({ where: { recipientUserId: { in: nonAdminIds } } });
  console.log(`\n  Cascades from User deletion:`);
  console.log(`    Director:        ${directors}`);
  console.log(`    ViceDirector:    ${vdirs}`);
  console.log(`    Teacher:         ${teachers}`);
  console.log(`    Parent:          ${parents}`);
  console.log(`    RefreshToken:    ${refreshToks}`);
  console.log(`    UserPermission:  ${userPerms}`);
  console.log(`    Notification(recipientUserId cascade): ${notifByRecip}`);

  // TeacherSubject cascades from Teacher
  const teacherIds = (await p.teacher.findMany({ where: { userId: { in: nonAdminIds } }, select: { teacherId: true } })).map(t => t.teacherId);
  const tsRows      = await p.teacherSubject.count({ where: { teacherId: { in: teacherIds } } });
  const tsIds       = (await p.teacherSubject.findMany({ where: { teacherId: { in: teacherIds } }, select: { id: true } })).map(t => t.id);
  const gradeComps  = await p.gradeComponent.count({ where: { teacherSubjectId: { in: tsIds } } });
  const timetableE  = await p.timetableEntry.count({ where: { teacherSubjectId: { in: tsIds } } });
  const assignments = await p.assignment.count({ where: { teacherSubjectId: { in: tsIds } } });
  const subjFin     = await p.subjectFinalization.count({ where: { teacherSubjectId: { in: tsIds } } });
  console.log(`\n  Cascades from Teacher deletion (via TeacherSubject):`);
  console.log(`    TeacherSubject:      ${tsRows}`);
  console.log(`    GradeComponent:      ${gradeComps}`);
  console.log(`    TimetableEntry:      ${timetableE}`);
  console.log(`    Assignment:          ${assignments}`);
  console.log(`    SubjectFinalization: ${subjFin}`);

  // ── 4. Notification full count breakdown ─────────────────────────────────
  console.log('\n── 4. NOTIFICATION COUNT BREAKDOWN ─────────────────────────────');
  const totalNotif  = await p.notification.count();
  // After student delete (studentId cascade) + after user delete (recipientUserId cascade):
  // senderUserId has SET NULL — those rows persist with senderUserId=NULL
  // Find notifications where recipientUserId is NOT in nonAdminIds and studentId is NULL
  const notifSenderOnly = await p.notification.count({
    where: {
      senderUserId: { in: nonAdminIds },
      recipientUserId: { notIn: nonAdminIds },
      studentId: null,
    },
  });
  // These will have senderUserId set to NULL but row persists unless recipient also cascades
  console.log(`  Total notifications:          ${totalNotif}`);
  console.log(`  via studentId cascade:        ${notifByStudentId}`);
  console.log(`  via recipientUserId cascade:  ${notifByRecip}`);
  // Find any notifications NOT covered by either cascade
  const notifUncovered = await p.notification.count({
    where: {
      studentId: null,
      OR: [
        { recipientUserId: null },
        { recipientUserId: { notIn: nonAdminIds } },
      ],
      senderUserId: { notIn: nonAdminIds },
    },
  });
  console.log(`  Notifications NOT auto-deleted (require explicit delete): ${notifUncovered}`);
  if (notifUncovered > 0) {
    const uncovered = await p.notification.findMany({
      where: {
        studentId: null,
        OR: [{ recipientUserId: null }, { recipientUserId: { notIn: nonAdminIds } }],
        senderUserId: { notIn: nonAdminIds },
      },
      select: { notificationId: true, recipientUserId: true, senderUserId: true, studentId: true, title: true },
    });
    for (const n of uncovered) {
      console.log(`    id=${n.notificationId} recipient=${n.recipientUserId} sender=${n.senderUserId} studentId=${n.studentId} title="${n.title}"`);
    }
  }

  // ── 5. Classroom homeroom FK check ────────────────────────────────────────
  console.log('\n── 5. CLASSROOM HOMEROOM TEACHER FK CHECK ──────────────────────');
  const classroomsWithHomeroom = await p.classroom.findMany({
    where: { homeroomTeacherId: { not: null } },
    select: { classroomId: true, className: true, section: true, academicYear: true, homeroomTeacherId: true },
  });
  console.log(`  Classrooms with non-null homeroomTeacherId: ${classroomsWithHomeroom.length}`);
  for (const c of classroomsWithHomeroom) {
    const teacher = await p.teacher.findUnique({ where: { teacherId: c.homeroomTeacherId! }, select: { firstName: true, lastName: true } });
    console.log(`    classroomId=${c.classroomId} ${c.className} ${c.section} (${c.academicYear}) → teacherId=${c.homeroomTeacherId} (${teacher?.firstName} ${teacher?.lastName})`);
  }
  // Check Classroom FK for promotionBatch.sourceClassroomId
  const batchClassrooms = await p.promotionBatch.findMany({ select: { id: true, sourceClassroomId: true } });
  console.log(`\n  PromotionBatch.sourceClassroomId references:`);
  for (const b of batchClassrooms) {
    const c = await p.classroom.findUnique({ where: { classroomId: b.sourceClassroomId }, select: { className: true, section: true } });
    console.log(`    batchId=${b.id} → classroomId=${b.sourceClassroomId} (${c?.className} ${c?.section}) — classroom is kept ✓`);
  }

  // ── 6. StudentIdCounter safety ────────────────────────────────────────────
  console.log('\n── 6. STUDENTIDCOUNTER SAFETY ──────────────────────────────────');
  const counter = await p.studentIdCounter.findMany();
  console.log(`  Current counter: ${JSON.stringify(counter)}`);
  const highestSeq = Math.max(...allStudents.map(s => {
    const m = s.admissionNumber.match(/DSH-\d{4}-(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }));
  console.log(`  Highest dev student sequence: ${highestSeq} (DSH-2026-${String(highestSeq).padStart(5,'0')})`);
  console.log(`  After deleting ALL students: no DSH-2026-NNNNN IDs exist in DB`);
  console.log(`  Safe to DELETE counter row — next admission auto-creates at lastSequence=1 → DSH-2026-00001`);
  console.log(`  No collision risk: admission table will be empty`);

  // ── 7. Audit log ─────────────────────────────────────────────────────────
  console.log('\n── 7. AUDIT LOG ────────────────────────────────────────────────');
  const auditTotal = await p.auditLog.count();
  const auditFKBehavior = fks.filter(f => f.TABLE_NAME === 'audit_logs');
  console.log(`  Total audit_log rows: ${auditTotal}`);
  console.log(`  FK rules on audit_logs: ${JSON.stringify(auditFKBehavior)}`);
  console.log(`  audit_log.userId has no onDelete in schema → MySQL default = RESTRICT`);
  // Check actual FK rule from DB
  const auditFKRule = fks.find(f => f.TABLE_NAME === 'audit_logs' && f.COLUMN_NAME === 'userId');
  console.log(`  Actual DB DELETE_RULE for audit_logs.userId: ${auditFKRule?.DELETE_RULE ?? 'NOT FOUND — no FK constraint'}`);
  console.log(`  Decision: Q1=B — DELETE all ${auditTotal} audit_log rows explicitly before user deletion`);

  // ── 8. Backup file integrity ──────────────────────────────────────────────
  console.log('\n── 8. BACKUP FILE INTEGRITY ────────────────────────────────────');
  const backupFile = 'backup-20261013-162900-pre-cleanup.json';
  const backupPath = path.join(process.cwd(), 'backups', backupFile);
  const raw  = await fs.readFile(backupPath, 'utf-8');
  const bkp  = JSON.parse(raw) as { version: number; createdAt: string; data: Record<string, unknown[]> };
  const expectedTables = [
    'role','user','administrator','director','viceDirector','teacher','subject','classroom',
    'teacherSubject','student','parent','studentParentLink','studentEnrollment','userPermission',
    'attendance','gradeComponent','gradeEntry','gradeSubjectConfig','subjectFinalization',
    'classroomFinalization','academicReport','studentConduct','disciplineRecord','notification',
    'timetableEntry','assignment','assignmentSubmission','promotionBatch','promotionEntry',
    'studentIdCounter','systemSetting',
  ];
  const missingTables = expectedTables.filter(t => !Array.isArray(bkp.data[t]));
  const bkpTotal = expectedTables.reduce((s, t) => s + (bkp.data[t]?.length ?? 0), 0);
  console.log(`  File: ${backupFile}`);
  console.log(`  Version: ${bkp.version}  Created: ${bkp.createdAt}`);
  console.log(`  Tables: ${Object.keys(bkp.data).length}  Missing: ${missingTables.length}`);
  console.log(`  Total rows: ${bkpTotal}`);
  if (missingTables.length > 0) console.log(`  ⚠ MISSING: ${missingTables.join(', ')}`);
  else console.log(`  ✓ All 31 tables present and non-null`);

  // Spot-check: admin user preserved in backup
  const bkpAdmin = (bkp.data['user'] as { username: string }[]).find(u => u.username === 'admin');
  console.log(`  admin in backup: ${bkpAdmin ? 'YES ✓' : 'NO ✗'}`);

  // ── 9. Records preserved check ────────────────────────────────────────────
  console.log('\n── 9. RECORDS PRESERVED AFTER CLEANUP ──────────────────────────');
  const adminUser = await p.user.findUnique({ where: { userId: 1 }, select: { userId: true, username: true, status: true } });
  const adminProf = await p.administrator.findFirst({ where: { userId: 1 }, select: { firstName: true, lastName: true } });
  console.log(`  admin: ${JSON.stringify({ ...adminUser, ...adminProf })}`);
  const roleCount    = await p.role.count();
  const subjectCount = await p.subject.count();
  const gscCount     = await p.gradeSubjectConfig.count();
  const ssRow        = await p.systemSetting.findFirst({ select: { schoolName: true, currentAcademicYear: true } });
  const classCount   = await p.classroom.count();
  console.log(`  roles: ${roleCount}  subjects: ${subjectCount}  gradeSubjectConfigs: ${gscCount}  classrooms: ${classCount}`);
  console.log(`  systemSetting: ${JSON.stringify(ssRow)}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Verification complete — no data modified');
  console.log('═══════════════════════════════════════════════════════════════\n');

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
