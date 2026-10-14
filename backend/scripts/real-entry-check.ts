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

  // All grade entries for real students 9 and 10
  console.log('\n=== ALL GRADE ENTRIES for real students 9 and 10 ===');
  const entries = await prisma.gradeEntry.findMany({
    where: { studentId: { in: [9, 10] } },
    include: {
      gradeComponent: {
        include: {
          teacherSubject: {
            include: {
              teacher: { select: { teacherId: true, firstName: true, lastName: true } },
              subject: { select: { subjectName: true } },
              classroom: { select: { className: true, section: true, academicYear: true } },
            },
          },
        },
      },
    },
  });
  for (const e of entries) {
    const gc = e.gradeComponent;
    const ts = gc.teacherSubject;
    const demoTeacher = ts.teacher.teacherId === 1;
    console.log(`  ${demoTeacher ? '[DEMO-TEACHER]' : '[REAL-TEACHER]'} entryId=${e.gradeEntryId} studentId=${e.studentId} compId=${e.gradeComponentId}(${gc.name}) teacher=${ts.teacher.firstName} ${ts.teacher.lastName} subj=${ts.subject.subjectName} class=${ts.classroom.className}${ts.classroom.section}(${ts.classroom.academicYear}) score=${e.score}`);
  }

  // Is there any real-teacher TeacherSubject for English in Grade 9A?
  console.log('\n=== TEACHER-SUBJECTS for Grade 9A (classroomId=1) ===');
  const tsG9A = await prisma.teacherSubject.findMany({
    where: { classroomId: 1 },
    include: {
      teacher: { select: { teacherId: true, firstName: true, lastName: true } },
      subject: { select: { subjectId: true, subjectName: true } },
    },
  });
  for (const ts of tsG9A) {
    const tag = ts.teacher.teacherId === 1 ? '[DEMO]' : '[REAL]';
    console.log(`  ${tag} tsId=${ts.id} teacherId=${ts.teacher.teacherId} name=${ts.teacher.firstName} ${ts.teacher.lastName} subject=${ts.subject.subjectName}(id=${ts.subject.subjectId})`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
