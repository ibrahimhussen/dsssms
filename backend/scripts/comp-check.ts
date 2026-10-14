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

  // GradeComponent with gradeComponentId=5 - which teacherSubject does it belong to?
  console.log('\n=== GRADE COMPONENT id=5 ===');
  const comp5 = await prisma.gradeComponent.findUnique({
    where: { gradeComponentId: 5 },
    include: {
      teacherSubject: {
        include: {
          teacher: { select: { teacherId: true, firstName: true, lastName: true } },
          subject: { select: { subjectName: true } },
          classroom: { select: { className: true, section: true, academicYear: true } },
        },
      },
    },
  });
  console.log(`  gradeComponentId=5 name=${comp5?.name} year=${comp5?.academicYear} sem=${comp5?.semester}`);
  console.log(`  teacherSubjectId=${comp5?.teacherSubjectId}`);
  console.log(`  teacher: ${comp5?.teacherSubject.teacher.firstName} ${comp5?.teacherSubject.teacher.lastName} (id=${comp5?.teacherSubject.teacher.teacherId})`);
  console.log(`  subject: ${comp5?.teacherSubject.subject.subjectName}`);
  console.log(`  classroom: ${comp5?.teacherSubject.classroom.className} ${comp5?.teacherSubject.classroom.section} (${comp5?.teacherSubject.classroom.academicYear})`);

  // All GradeComponents belonging to demo teacher's TeacherSubjects (tsIds 1 and 2)
  console.log('\n=== ALL GRADE COMPONENTS for demo teacher TeacherSubjects (tsId 1,2) ===');
  const comps = await prisma.gradeComponent.findMany({
    where: { teacherSubjectId: { in: [1, 2] } },
    select: { gradeComponentId: true, name: true, academicYear: true, semester: true, teacherSubjectId: true },
    orderBy: { gradeComponentId: 'asc' },
  });
  for (const c of comps) {
    console.log(`  compId=${c.gradeComponentId} tsId=${c.teacherSubjectId} name=${c.name} year=${c.academicYear} sem=${c.semester}`);
  }

  // GradeEntries for non-demo students under ALL demo teacher components
  console.log('\n=== GRADE ENTRIES for non-demo students under demo-teacher components (all tsIds) ===');
  const demoTSids = [1, 2]; // only Grade 9A ones
  const allDemoComps = await prisma.gradeComponent.findMany({
    where: { teacherSubjectId: { in: demoTSids } },
    select: { gradeComponentId: true },
  });
  const allDemoCompIds = allDemoComps.map(c => c.gradeComponentId);
  const realEntries = await prisma.gradeEntry.findMany({
    where: { gradeComponentId: { in: allDemoCompIds }, studentId: { notIn: [1,2,3,4,5,6] } },
    select: { gradeEntryId: true, studentId: true, gradeComponentId: true, score: true },
  });
  console.log(`  Count: ${realEntries.length}`);
  for (const e of realEntries) {
    console.log(`  gradeEntryId=${e.gradeEntryId} studentId=${e.studentId} compId=${e.gradeComponentId} score=${e.score}`);
  }

  // Which TeacherSubject does gradeComponent 5 actually belong to?
  // (confirm from the raw teacherSubjectId field)
  console.log('\n=== CONFIRMATION: TeacherSubject for gradeComponentId 5 ===');
  const raw = await prisma.gradeComponent.findUnique({
    where: { gradeComponentId: 5 },
    select: { gradeComponentId: true, teacherSubjectId: true, name: true, academicYear: true },
  });
  console.log(`  gradeComponentId=5 → teacherSubjectId=${raw?.teacherSubjectId} name=${raw?.name} year=${raw?.academicYear}`);

  // Are there ANY grade entries for real students under demo-teacher Grade 9A components?
  console.log('\n=== FINAL VERDICT: real-student grade entries under tsId 1 or 2 ===');
  const verdict = await prisma.gradeEntry.count({
    where: { gradeComponentId: { in: allDemoCompIds }, studentId: { notIn: [1,2,3,4,5,6] } },
  });
  console.log(`  Count: ${verdict} (0 = safe to cascade-delete all components and entries under tsIds 1&2)`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
