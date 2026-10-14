import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

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

  // All real (non-demo) teachers
  console.log('\n=== ALL TEACHERS ===');
  const teachers = await prisma.teacher.findMany({
    include: { user: { select: { username: true, userId: true } } },
    orderBy: { teacherId: 'asc' },
  });
  for (const t of teachers) {
    const isDemo = t.teacherId === 1;
    const tag = isDemo ? '[DEMO]' : '[REAL]';
    console.log(`  ${tag} teacherId=${t.teacherId} userId=${t.user.userId} username=${t.user.username} name=${t.firstName} ${t.lastName}`);
  }

  // TeacherSubjects for classroom 1 (Grade 9A 2026/27) - real teachers?
  console.log('\n=== TEACHER-SUBJECTS for Grade 9A (classroomId=1) ===');
  const ts1 = await prisma.teacherSubject.findMany({
    where: { classroomId: 1 },
    include: {
      teacher: { select: { teacherId: true, firstName: true, lastName: true } },
      subject: { select: { subjectName: true } },
    },
  });
  for (const ts of ts1) {
    console.log(`  tsId=${ts.id} teacherId=${ts.teacher.teacherId} name=${ts.teacher.firstName} ${ts.teacher.lastName} subject=${ts.subject.subjectName}`);
  }

  // Classroom 16 detail
  console.log('\n=== CLASSROOM 16 DETAIL ===');
  const c16 = await prisma.classroom.findUnique({
    where: { classroomId: 16 },
    include: {
      students: { select: { studentId: true, admissionNumber: true, firstName: true, lastName: true } },
      homeroomTeacher: { select: { teacherId: true, firstName: true, lastName: true } },
    },
  });
  console.log(`  classroomId=16 name=${c16?.className} section=${c16?.section} year=${c16?.academicYear} homeroom=${c16?.homeroomTeacher ? `${c16.homeroomTeacher.firstName} ${c16.homeroomTeacher.lastName} (id=${c16.homeroomTeacher.teacherId})` : 'none'} students=${c16?.students.length ?? 0}`);

  // TeacherSubject id=5 detail (demo teacher + classroom 16)
  console.log('\n=== TEACHER-SUBJECT id=5 (demo teacher, classroom 16) ===');
  const ts5 = await prisma.teacherSubject.findUnique({
    where: { id: 5 },
    include: {
      teacher: { select: { teacherId: true, firstName: true, lastName: true } },
      subject: { select: { subjectName: true } },
      classroom: { select: { className: true, section: true, academicYear: true } },
      gradeComponents: { select: { gradeComponentId: true, name: true, academicYear: true, semester: true, isReleased: true } },
    },
  });
  console.log(`  tsId=5 teacher=${ts5?.teacher.firstName} ${ts5?.teacher.lastName} subject=${ts5?.subject.subjectName} classroom=${ts5?.classroom.className} ${ts5?.classroom.section} (${ts5?.classroom.academicYear})`);
  console.log('  GradeComponents:', JSON.stringify(ts5?.gradeComponents));

  // GradeEntries under ts5 components (real students 9 and 10)
  const ts5CompIds = ts5?.gradeComponents.map(c => c.gradeComponentId) ?? [];
  const ts5Entries = await prisma.gradeEntry.findMany({
    where: { gradeComponentId: { in: ts5CompIds } },
    select: { gradeEntryId: true, studentId: true, gradeComponentId: true, score: true },
  });
  console.log('  GradeEntries:', JSON.stringify(ts5Entries));

  // The 4 attendance rows for real students by demo teacher - which classroom?
  console.log('\n=== 4 ATTENDANCE ROWS (real students, demo teacher) ===');
  const badAtt = await prisma.attendance.findMany({
    where: { teacherId: 1, studentId: { notIn: [1,2,3,4,5,6] } },
    select: { attendanceId: true, studentId: true, classroomId: true, attendanceDate: true, status: true },
  });
  for (const a of badAtt) {
    console.log(`  attId=${a.attendanceId} studentId=${a.studentId} classroomId=${a.classroomId} date=${a.attendanceDate.toISOString().slice(0,10)} status=${a.status}`);
  }
  // Who teaches in the same classroom? (to suggest reassignment target)
  const classroomIds = [...new Set(badAtt.map(a => a.classroomId))];
  for (const cid of classroomIds) {
    const tsForClass = await prisma.teacherSubject.findMany({
      where: { classroomId: cid, teacherId: { not: 1 } },
      include: { teacher: { select: { teacherId: true, firstName: true, lastName: true } } },
    });
    console.log(`  Real teachers in classroomId=${cid}:`, tsForClass.map(ts => `${ts.teacher.firstName} ${ts.teacher.lastName} (teacherId=${ts.teacher.teacherId})`).join(', ') || 'none');
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
