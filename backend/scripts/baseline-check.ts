import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const dbUrl   = new URL(process.env.DATABASE_URL!);
const adapter = new PrismaMariaDb({
  host: dbUrl.hostname, port: Number(dbUrl.port || 3306),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.replace(/^\//, ''),
  connectionLimit: 3,
});
const prisma = new PrismaClient({ adapter });

const DEMO_ADM = [
  'DSH-2026-00001', 'DSH-2026-00002', 'DSH-2026-00003',
  'DSH-2026-00004', 'DSH-2026-00005', 'DSH-2026-00006',
];
const DEMO_PARENTS = [
  'tesfaye.alemu', 'getachew.worku', 'mulugeta.bekele',
  'bekele.girma',  'tesfaye.lemma',  'haile.wolde',
];

async function main(): Promise<void> {
  const demoStudents = await prisma.student.findMany({
    where: { admissionNumber: { in: DEMO_ADM } },
    include: { user: true },
  });
  const demoStudentIds = demoStudents.map(s => s.studentId);
  console.log('Demo student DB ids:', JSON.stringify(demoStudentIds));

  const teacherUser = await prisma.user.findUnique({
    where: { username: 'abebe.kebede' },
    include: { teacher: true },
  });
  console.log('Demo teacher teacherId:', teacherUser?.teacher?.teacherId, 'userId:', teacherUser?.userId);

  const demoParentUsers  = await prisma.user.findMany({ where: { username: { in: DEMO_PARENTS } } });
  const demoStudentUids  = demoStudents.map(s => s.user?.userId).filter((x): x is number => x !== undefined);
  const allDemoUserIds   = [...new Set([...demoParentUsers.map(u => u.userId), ...demoStudentUids])];
  console.log('All demo userIds:', JSON.stringify(allDemoUserIds));

  const ptMessages = await prisma.parentTeacherMessage.count({
    where: { studentId: { in: demoStudentIds } },
  });
  console.log('ParentTeacherMessages for demo students:', ptMessages);

  const promoEntries = await prisma.promotionEntry.findMany({
    where:  { studentId: { in: demoStudentIds } },
    select: { id: true, studentId: true, batchId: true },
  });
  console.log('PromotionEntries:', JSON.stringify(promoEntries));

  const batchIds = [...new Set(promoEntries.map(e => e.batchId))];
  for (const bid of batchIds) {
    const total = await prisma.promotionEntry.count({ where: { batchId: bid } });
    const demoC = await prisma.promotionEntry.count({ where: { batchId: bid, studentId: { in: demoStudentIds } } });
    console.log(`Batch ${bid} — total entries: ${total}, demo entries: ${demoC}, all-demo: ${total === demoC}`);
  }

  const t = {
    users:            await prisma.user.count(),
    students:         await prisma.student.count(),
    parents:          await prisma.parent.count(),
    teachers:         await prisma.teacher.count(),
    directors:        await prisma.director.count(),
    viceDirectors:    await prisma.viceDirector.count(),
    gradeEntries:     await prisma.gradeEntry.count(),
    gradeComponents:  await prisma.gradeComponent.count(),
    attendance:       await prisma.attendance.count(),
    enrollments:      await prisma.studentEnrollment.count(),
    academicReports:  await prisma.academicReport.count(),
    assignmentSubs:   await prisma.assignmentSubmission.count(),
    assignments:      await prisma.assignment.count(),
    teacherSubjects:  await prisma.teacherSubject.count(),
    timetableEntries: await prisma.timetableEntry.count(),
    parentLinks:      await prisma.studentParentLink.count(),
    notifications:    await prisma.notification.count(),
    promotionEntries: await prisma.promotionEntry.count(),
    promotionBatches: await prisma.promotionBatch.count(),
  };
  console.log('\nBASELINE TOTALS:');
  for (const [k, v] of Object.entries(t)) console.log(`  ${k.padEnd(18)}: ${v}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
