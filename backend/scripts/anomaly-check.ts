import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const DEMO_STUDENT_IDS = [1, 2, 3, 4, 5, 6];

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

  // ── Anomaly 1: real student grade entries under demo-teacher components ───
  console.log('\n=== ANOMALY 1: GradeEntries for real students under demo teacher components ===');
  const demoTS = await prisma.teacherSubject.findMany({ where: { teacherId: 1 }, select: { id: true, subjectId: true, classroomId: true } });
  const demoTSids = demoTS.map(t => t.id);
  console.log('Demo TeacherSubject rows:', JSON.stringify(demoTS));
  const demoComps = await prisma.gradeComponent.findMany({
    where: { teacherSubjectId: { in: demoTSids } },
    select: { gradeComponentId: true, name: true, academicYear: true, semester: true, teacherSubjectId: true },
  });
  const demoCompIds = demoComps.map(c => c.gradeComponentId);
  const realEntries = await prisma.gradeEntry.findMany({
    where: { gradeComponentId: { in: demoCompIds }, studentId: { notIn: DEMO_STUDENT_IDS } },
    select: { gradeEntryId: true, studentId: true, gradeComponentId: true, score: true },
  });
  for (const e of realEntries) {
    const comp = demoComps.find(c => c.gradeComponentId === e.gradeComponentId);
    console.log(`  gradeEntryId=${e.gradeEntryId} studentId=${e.studentId} compId=${e.gradeComponentId} (${comp?.name} ${comp?.academicYear} ${comp?.semester}) score=${e.score}`);
  }

  // ── Anomaly 2: classroom 13 ───────────────────────────────────────────────
  console.log('\n=== ANOMALY 2: classroom id=13 ===');
  const c13 = await prisma.classroom.findUnique({
    where: { classroomId: 13 },
    include: { students: { select: { studentId: true, admissionNumber: true, firstName: true, lastName: true } } },
  });
  console.log('Classroom 13:', JSON.stringify({ id:c13?.classroomId, name:c13?.className, section:c13?.section, year:c13?.academicYear, homeroom:c13?.homeroomTeacherId, studentCount:c13?.students.length }));
  if (c13?.students.length) {
    for (const s of c13.students) console.log(`  student: ${s.admissionNumber} ${s.firstName} ${s.lastName}`);
  }
  const ts13 = await prisma.teacherSubject.findMany({ where: { classroomId: 13 }, select: { id: true, teacherId: true, subjectId: true } });
  console.log('TeacherSubjects for classroom 13:', JSON.stringify(ts13));

  // ── Attendance records 21,25,26,27 detail ────────────────────────────────
  console.log('\n=== ANOMALY 3: Attendance by demo teacher for real students ===');
  // attendanceId is the PK field name
  const anomalyAtt2 = await prisma.attendance.findMany({
    where: { attendanceId: { in: [21, 25, 26, 27] } },
    select: { attendanceId: true, studentId: true, teacherId: true, classroomId: true, attendanceDate: true, status: true },
  });
  console.log('By attendanceId:', JSON.stringify(anomalyAtt2));
  // These are real student records that reference the demo teacher — what does this mean?
  // The demo teacher was assigned to classroom 1 (Grade 9A). Real students 9,10,11 are now in Grade 9A.
  // So when the real teacher marked attendance they used the demo teacher's teacherId — or
  // the real students were added to Grade 9A which uses the demo teacher as homeroom.
  // Check: who are the teachers for Grade 9A now?
  const g9aTeacherSubjects = await prisma.teacherSubject.findMany({
    where: { classroomId: 1 },
    include: { teacher: { select: { teacherId: true, firstName: true, lastName: true } }, subject: { select: { subjectName: true } } },
  });
  console.log('\nTeacherSubjects for Grade 9A (classroomId=1):');
  for (const ts of g9aTeacherSubjects) {
    console.log(`  tsId=${ts.id} teacher=${ts.teacher.firstName} ${ts.teacher.lastName} (id=${ts.teacher.teacherId}) subject=${ts.subject.subjectName}`);
  }

  // ── All classrooms overview ───────────────────────────────────────────────
  console.log('\n=== ALL CLASSROOMS ===');
  const classrooms = await prisma.classroom.findMany({
    select: { classroomId: true, className: true, section: true, academicYear: true, homeroomTeacherId: true,
      _count: { select: { students: true } } },
    orderBy: { classroomId: 'asc' },
  });
  for (const c of classrooms) {
    console.log(`  id=${c.classroomId} ${c.className} ${c.section} (${c.academicYear}) homeroom=${c.homeroomTeacherId ?? 'none'} students=${c._count.students}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
