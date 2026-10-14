import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const DEMO_STUDENT_IDS = [1, 2, 3, 4, 5, 6];
const DEMO_STUDENT_USER_IDS = [5, 7, 9, 11, 13, 15];
const DEMO_PARENT_USER_IDS  = [6, 8, 10, 12, 14, 16];

async function main(): Promise<void> {
  const dbUrl = new URL(process.env.DATABASE_URL!);
  const adapter = new PrismaMariaDb({
    host: dbUrl.hostname, port: Number(dbUrl.port || 3306),
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.replace(/^\//, ''),
    connectionLimit: 3,
  });
  const prisma = new PrismaClient({ adapter });

  // ── All students with classroom ──────────────────────────────────────────
  console.log('\n=== ALL STUDENTS ===');
  const all = await prisma.student.findMany({
    include: { user: { select: { username: true } }, classroom: { select: { className: true, section: true } } },
    orderBy: { studentId: 'asc' },
  });
  for (const s of all) {
    const tag = DEMO_STUDENT_IDS.includes(s.studentId) ? '[DEMO]' : '[REAL]';
    console.log(`  ${tag} id=${s.studentId} adm=${s.admissionNumber} name=${s.firstName} ${s.lastName} class=${s.classroom.className} ${s.classroom.section}`);
  }

  // ── Attendance by demo teacher ──────────────────────────────────────────
  console.log('\n=== ATTENDANCE BY DEMO TEACHER (teacherId=1) ===');
  const demoTeacherAtt = await prisma.attendance.findMany({
    where: { teacherId: 1 },
    select: { attendanceId: true, studentId: true, attendanceDate: true },
  });
  console.log('Total:', demoTeacherAtt.length);
  const realStudentAtt = demoTeacherAtt.filter(a => !DEMO_STUDENT_IDS.includes(a.studentId));
  console.log('For real students:', realStudentAtt.length);
  for (const a of realStudentAtt) {
    console.log(`  attendanceId=${a.attendanceId} studentId=${a.studentId} date=${a.attendanceDate.toISOString().slice(0,10)}`);
  }

  // ── Notifications linked to demo ─────────────────────────────────────────
  console.log('\n=== NOTIFICATIONS ===');
  const allDemoIds = [...DEMO_STUDENT_USER_IDS, ...DEMO_PARENT_USER_IDS];
  const notifToDemo = await prisma.notification.count({
    where: { OR: [
      { recipientUserId: { in: allDemoIds } },
      { senderUserId:    { in: allDemoIds } },
      { studentId:       { in: DEMO_STUDENT_IDS } },
    ]},
  });
  const notifTotal = await prisma.notification.count();
  console.log(`Total: ${notifTotal}  Demo-linked: ${notifToDemo}  Non-demo: ${notifTotal - notifToDemo}`);

  // ── Promotion batches ────────────────────────────────────────────────────
  console.log('\n=== PROMOTION BATCHES ===');
  const batches = await prisma.promotionBatch.findMany({
    select: { id: true, sourceAcademicYear: true, targetAcademicYear: true, status: true, sourceClassroomId: true },
  });
  for (const b of batches) {
    console.log(`  Batch id=${b.id} ${b.sourceAcademicYear}->${b.targetAcademicYear} status=${b.status} classroomId=${b.sourceClassroomId}`);
  }

  // ── ParentTeacherMessages ────────────────────────────────────────────────
  console.log('\n=== PARENT-TEACHER MESSAGES for demo students ===');
  const ptm = await prisma.parentTeacherMessage.findMany({
    where: { studentId: { in: DEMO_STUDENT_IDS } },
    select: { id: true, studentId: true, senderUserId: true, recipientUserId: true, createdAt: true },
  });
  for (const m of ptm) {
    console.log(`  id=${m.id} studentId=${m.studentId} sender=${m.senderUserId} recipient=${m.recipientUserId} date=${m.createdAt.toISOString().slice(0,10)}`);
  }

  // ── Classrooms with demo teacher as homeroom ─────────────────────────────
  console.log('\n=== CLASSROOMS WITH DEMO TEACHER AS HOMEROOM ===');
  const homeroomClassrooms = await prisma.classroom.findMany({
    where: { homeroomTeacherId: 1 },
    select: { classroomId: true, className: true, section: true, academicYear: true },
  });
  for (const c of homeroomClassrooms) {
    console.log(`  classroomId=${c.classroomId} ${c.className} ${c.section} (${c.academicYear})`);
  }

  // ── Attendance: demo-student rows (for count verification) ───────────────
  console.log('\n=== ATTENDANCE for demo students ===');
  const demoAtt = await prisma.attendance.count({ where: { studentId: { in: DEMO_STUDENT_IDS } } });
  console.log(`Total attendance rows for demo students: ${demoAtt}`);

  // ── GradeComponent orphan check ──────────────────────────────────────────
  // After deleting GradeEntries via cascade from Students,
  // GradeComponents themselves still exist until TeacherSubject is deleted.
  // Verify: are there GradeEntry rows for NON-demo students under the demo teacher's components?
  console.log('\n=== GRADE ENTRIES: demo teacher components, non-demo students ===');
  const demoTS = await prisma.teacherSubject.findMany({ where: { teacherId: 1 }, select: { id: true } });
  const demoTSids = demoTS.map(t => t.id);
  const demoComps = await prisma.gradeComponent.findMany({ where: { teacherSubjectId: { in: demoTSids } }, select: { gradeComponentId: true } });
  const demoCompIds = demoComps.map(c => c.gradeComponentId);
  const realStudentEntries = await prisma.gradeEntry.count({
    where: { gradeComponentId: { in: demoCompIds }, studentId: { notIn: DEMO_STUDENT_IDS } },
  });
  console.log(`GradeEntries for non-demo students in demo-teacher components: ${realStudentEntries}`);
  console.log(`(expected 0 — demo teacher only taught demo students)`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
