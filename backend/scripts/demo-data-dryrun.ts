/**
 * demo-data-dryrun.ts
 *
 * READ-ONLY dry-run: counts every demo record that Phase 5.2 proposes to delete.
 * Nothing is deleted. Run with:
 *   npx tsx backend/scripts/demo-data-dryrun.ts
 *
 * Admission numbers used as demo identifiers: DSH-2026-00001 through DSH-2026-00006
 * Demo staff usernames: admin, abebe.kebede, director.demo, vicedirector.demo
 * Demo parent usernames: tesfaye.alemu, getachew.worku, mulugeta.bekele,
 *                        bekele.girma, tesfaye.lemma, haile.wolde
 */

import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) { console.error('DATABASE_URL not set'); process.exit(1); }

const dbUrl   = new URL(databaseUrl);
const adapter = new PrismaMariaDb({
  host:            dbUrl.hostname,
  port:            dbUrl.port ? Number(dbUrl.port) : 3306,
  user:            decodeURIComponent(dbUrl.username),
  password:        decodeURIComponent(dbUrl.password),
  database:        dbUrl.pathname.replace(/^\//, ''),
  connectionLimit: 5,
});
const prisma = new PrismaClient({ adapter });

// ── Demo identifiers ──────────────────────────────────────────────────────────
const DEMO_ADMISSION_NUMBERS = [
  'DSH-2026-00001', 'DSH-2026-00002', 'DSH-2026-00003',
  'DSH-2026-00004', 'DSH-2026-00005', 'DSH-2026-00006',
];
const DEMO_STAFF_USERNAMES = ['abebe.kebede', 'director.demo', 'vicedirector.demo'];
// Note: 'admin' is listed separately — it is a required system account and
// is NOT in the deletion list; only its password/email need updating.
const DEMO_PARENT_USERNAMES = [
  'tesfaye.alemu', 'getachew.worku', 'mulugeta.bekele',
  'bekele.girma',  'tesfaye.lemma',  'haile.wolde',
];

async function main(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  DSSSMS Phase 5.2 — Demo-Data Dry-Run Report (READ ONLY)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Resolve demo student records ──────────────────────────────────────────
  const demoStudents = await prisma.student.findMany({
    where: { admissionNumber: { in: DEMO_ADMISSION_NUMBERS } },
    include: { user: true },
  });
  const demoStudentIds   = demoStudents.map(s => s.studentId);
  const demoStudentUsers = demoStudents.map(s => s.user?.username).filter(Boolean);

  console.log(`DEMO STUDENTS FOUND: ${demoStudents.length} / 6 expected`);
  for (const s of demoStudents) {
    console.log(`  • ${s.admissionNumber} — ${s.firstName} ${s.lastName} (username: ${s.user?.username ?? 'no user'})`);
  }

  // ── Resolve demo staff ────────────────────────────────────────────────────
  const demoStaff = await prisma.user.findMany({
    where: { username: { in: DEMO_STAFF_USERNAMES } },
    include: { teacher: true, director: true, viceDirector: true },
  });
  console.log(`\nDEMO STAFF FOUND: ${demoStaff.length} / 3 expected (admin excluded — keep but update)`);
  for (const u of demoStaff) {
    const role = u.teacher ? 'TEACHER' : u.director ? 'DIRECTOR' : u.viceDirector ? 'VICE_DIRECTOR' : 'UNKNOWN';
    console.log(`  • ${u.username} (${role})`);
  }
  const demoTeacherIds    = demoStaff.filter(u => u.teacher).map(u => u.teacher!.teacherId);
  const demoDirectorIds   = demoStaff.filter(u => u.director).map(u => u.director!.directorId);
  const demoVDirIds       = demoStaff.filter(u => u.viceDirector).map(u => u.viceDirector!.viceDirectorId);

  // ── Resolve demo parents ──────────────────────────────────────────────────
  const demoParents = await prisma.user.findMany({
    where: { username: { in: DEMO_PARENT_USERNAMES } },
    include: { parent: true },
  });
  console.log(`\nDEMO PARENTS FOUND: ${demoParents.length} / 6 expected`);
  for (const u of demoParents) {
    console.log(`  • ${u.username} → ${u.parent?.fullName ?? 'no profile'}`);
  }
  const demoParentIds = demoParents.filter(u => u.parent).map(u => u.parent!.parentId);

  // ── Count dependent records ───────────────────────────────────────────────
  console.log('\n───────────────────────────────────────────────────────────');
  console.log('  RECORDS PROPOSED FOR DELETION (by table, in delete order)');
  console.log('───────────────────────────────────────────────────────────');

  if (demoStudentIds.length > 0) {
    const assignmentSubs = await prisma.assignmentSubmission.count({ where: { studentId: { in: demoStudentIds } } });
    const gradeEntries   = await prisma.gradeEntry.count({ where: { studentId: { in: demoStudentIds } } });
    const academicReps   = await prisma.academicReport.count({ where: { studentId: { in: demoStudentIds } } });
    const attendances    = await prisma.attendance.count({ where: { studentId: { in: demoStudentIds } } });
    const enrollments    = await prisma.studentEnrollment.count({ where: { studentId: { in: demoStudentIds } } });
    const parentLinks    = await prisma.studentParentLink.count({ where: { studentId: { in: demoStudentIds } } });
    const conducts       = await prisma.studentConduct.count({ where: { studentId: { in: demoStudentIds } } });
    const disciplines    = await prisma.disciplineRecord.count({ where: { studentId: { in: demoStudentIds } } });
    const promoEntries   = await prisma.promotionEntry.count({ where: { studentId: { in: demoStudentIds } } });

    console.log(`\n  [Student-linked] (${demoStudents.length} demo students)`);
    console.log(`    AssignmentSubmission  : ${assignmentSubs}`);
    console.log(`    GradeEntry            : ${gradeEntries}`);
    console.log(`    AcademicReport        : ${academicReps}`);
    console.log(`    Attendance            : ${attendances}`);
    console.log(`    StudentEnrollment     : ${enrollments}`);
    console.log(`    StudentParentLink     : ${parentLinks}`);
    console.log(`    StudentConduct        : ${conducts}`);
    console.log(`    DisciplineRecord      : ${disciplines}`);
    console.log(`    PromotionEntry        : ${promoEntries}`);
  }

  if (demoTeacherIds.length > 0) {
    // GradeComponent references teacherSubject, not teacher directly
    const teacherSubjects = await prisma.teacherSubject.findMany({ where: { teacherId: { in: demoTeacherIds } } });
    const tsIds = teacherSubjects.map(ts => ts.id);

    const timetableEntries  = tsIds.length > 0 ? await prisma.timetableEntry.count({ where: { teacherSubjectId: { in: tsIds } } }) : 0;
    const gradeComponents   = tsIds.length > 0 ? await prisma.gradeComponent.count({ where: { teacherSubjectId: { in: tsIds } } }) : 0;
    const subjectFinaliz    = tsIds.length > 0 ? await prisma.subjectFinalization.count({ where: { teacherSubjectId: { in: tsIds } } }) : 0;
    const assignments       = tsIds.length > 0 ? await prisma.assignment.count({ where: { teacherSubjectId: { in: tsIds } } }) : 0;

    console.log(`\n  [Teacher-linked] (${demoTeacherIds.length} demo teacher)`);
    console.log(`    TeacherSubject        : ${teacherSubjects.length}`);
    console.log(`    TimetableEntry        : ${timetableEntries}`);
    console.log(`    GradeComponent        : ${gradeComponents}  ← GradeEntry rows come from student deletion`);
    console.log(`    SubjectFinalization   : ${subjectFinaliz}`);
    console.log(`    Assignment            : ${assignments}`);
  }

  // ClassroomFinalization depends on classrooms — check if any exist
  const demoClassrooms = await prisma.classroom.findMany({
    where: { academicYear: '2026/27', className: { in: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'] } },
  });
  const demoClassroomIds = demoClassrooms.map(c => c.classroomId);
  if (demoClassroomIds.length > 0) {
    const classroomFinaliz = await prisma.classroomFinalization.count({ where: { classroomId: { in: demoClassroomIds } } });
    console.log(`\n  [Classroom-linked] (${demoClassrooms.length} classrooms for 2026/27)`);
    console.log(`    ClassroomFinalization : ${classroomFinaliz}`);
    console.log(`    NOTE: Classrooms themselves are structural — listed separately below`);
  }

  console.log(`\n  [Parent accounts] (${demoParentIds.length} demo parents)`);
  if (demoParentIds.length > 0) {
    const parentMsgs = await prisma.notification.count({ where: { recipientUserId: { in: demoParents.map(u => u.userId) } } });
    console.log(`    Notification (parent) : ${parentMsgs}`);
  }

  // StudentIdCounter
  const counter = await prisma.studentIdCounter.findUnique({ where: { year: 2026 } });
  console.log(`\n  [StudentIdCounter] year=2026, lastSequence=${counter?.lastSequence ?? 'NOT FOUND'}`);
  console.log(`    → Do NOT reset until real admissions are confirmed — real IDs may already use this counter`);

  // ── Summary table ──────────────────────────────────────────────────────────
  console.log('\n───────────────────────────────────────────────────────────');
  console.log('  RECORDS TO KEEP (required reference / configuration data)');
  console.log('───────────────────────────────────────────────────────────');

  const roles          = await prisma.role.count();
  const subjects       = await prisma.subject.count();
  const gscConfigs     = await prisma.gradeSubjectConfig.count();
  const systemSettings = await prisma.systemSetting.count();
  const adminUser      = await prisma.user.findUnique({ where: { username: 'admin' } });

  console.log(`  Role               : ${roles}  (required — all enum values)`);
  console.log(`  Subject            : ${subjects}  (required reference data)`);
  console.log(`  GradeSubjectConfig : ${gscConfigs}  (required — defines subject columns per grade)`);
  console.log(`  SystemSetting      : ${systemSettings}  (required — update school name/address before go-live)`);
  console.log(`  admin user         : ${adminUser ? 'EXISTS (keep — update password + email)' : 'NOT FOUND'}`);

  // ── Non-demo users check ───────────────────────────────────────────────────
  console.log('\n───────────────────────────────────────────────────────────');
  console.log('  SAFETY CHECK — Are any users NOT in the demo set?');
  console.log('───────────────────────────────────────────────────────────');

  const allDemoUsernames = [...demoStudentUsers, ...DEMO_STAFF_USERNAMES, ...DEMO_PARENT_USERNAMES, 'admin'];
  const nonDemoUsers = await prisma.user.findMany({
    where: { username: { notIn: allDemoUsernames as string[] } },
    select: { username: true, role: { select: { roleName: true } } },
  });

  if (nonDemoUsers.length === 0) {
    console.log('  ✓ No non-demo users found — database contains only seed data');
  } else {
    console.log(`  ⚠ WARNING: ${nonDemoUsers.length} user(s) found that are NOT in the demo set:`);
    for (const u of nonDemoUsers) {
      console.log(`    • ${u.username} (${u.role.roleName}) ← may be a real user — DO NOT delete`);
    }
    console.log('  → These users must be preserved. Adjust the cleanup plan accordingly.');
  }

  // ── Structural classrooms question ────────────────────────────────────────
  console.log('\n───────────────────────────────────────────────────────────');
  console.log('  CLASSROOMS — Require your decision');
  console.log('───────────────────────────────────────────────────────────');
  console.log('  The following 12 classrooms were seeded for 2026/27.');
  console.log('  If these match your real school structure, KEEP them.');
  console.log('  If not, they should be replaced with real classrooms.\n');
  for (const c of demoClassrooms) {
    const studentCount = await prisma.student.count({ where: { classroomId: c.classroomId } });
    console.log(`  • ${c.className} ${c.section} (${c.academicYear}) — ${studentCount} student(s) enrolled`);
  }

  // ── Audit log check ───────────────────────────────────────────────────────
  console.log('\n───────────────────────────────────────────────────────────');
  console.log('  AUDIT LOG — Preserved (never deleted by cleanup)');
  console.log('───────────────────────────────────────────────────────────');
  const auditCount = await prisma.auditLog.count();
  console.log(`  AuditLog rows      : ${auditCount}  (always preserved — not in backup model list)`);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  END OF DRY-RUN REPORT — No data was modified.');
  console.log('  Review the above and confirm before authorising cleanup.');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch(err => { console.error('Dry-run failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
