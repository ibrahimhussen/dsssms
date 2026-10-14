import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

const TABLES = [
  'role','user','administrator','director','viceDirector','teacher',
  'subject','classroom','teacherSubject','student','parent',
  'studentParentLink','studentEnrollment','userPermission','attendance',
  'gradeComponent','gradeEntry','gradeSubjectConfig','subjectFinalization',
  'classroomFinalization','academicReport','studentConduct','disciplineRecord',
  'notification','timetableEntry','assignment','assignmentSubmission',
  'promotionBatch','promotionEntry','studentIdCounter','systemSetting',
] as const;

async function main(): Promise<void> {
  const u = new URL(process.env.DATABASE_URL!);
  const a = new PrismaMariaDb({
    host: u.hostname, port: Number(u.port || 3306),
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''), connectionLimit: 3,
  });
  const p = new PrismaClient({ adapter: a });

  console.log('\n=== LIVE DATABASE COUNTS ===');
  let total = 0;
  for (const t of TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n: number = await (p as any)[t].count();
    total += n;
    console.log(`  ${t.padEnd(26)}: ${n}`);
  }
  console.log(`  ${'TOTAL'.padEnd(26)}: ${total}`);

  // Key records
  const ctr = await p.studentIdCounter.findMany();
  console.log('\n=== StudentIdCounter ===');
  console.log('  ', JSON.stringify(ctr));

  const admin = await p.user.findUnique({
    where: { username: 'admin' },
    select: { userId: true, username: true, status: true, isTemporaryPassword: true },
  });
  console.log('\n=== admin user ===');
  console.log('  ', JSON.stringify(admin));

  const ss = await p.systemSetting.findFirst({
    select: { id: true, schoolName: true, currentAcademicYear: true, promotionPassMark: true, minimumSubjectPassMark: true },
  });
  console.log('\n=== SystemSetting ===');
  console.log('  ', JSON.stringify(ss));

  const roles = await p.role.findMany({ select: { roleName: true } });
  console.log('\n=== Roles ===');
  console.log('  ', roles.map(r => r.roleName).join(', '));

  const subjects = await p.subject.findMany({ select: { subjectCode: true, subjectName: true } });
  console.log('\n=== Subjects ===');
  for (const s of subjects) console.log(`  ${s.subjectCode}: ${s.subjectName}`);

  const gsc = await p.gradeSubjectConfig.groupBy({
    by: ['className'],
    _count: { id: true },
    orderBy: { className: 'asc' },
  });
  console.log('\n=== GradeSubjectConfig (by grade) ===');
  for (const g of gsc) console.log(`  ${g.className}: ${g._count.id} subjects`);

  const classrooms = await p.classroom.findMany({
    select: { classroomId: true, className: true, section: true, academicYear: true, homeroomTeacherId: true,
      _count: { select: { students: true } } },
    orderBy: { classroomId: 'asc' },
  });
  console.log('\n=== Classrooms (all 17) ===');
  for (const c of classrooms) {
    console.log(`  id=${c.classroomId} ${c.className} ${c.section} (${c.academicYear}) homeroom=${c.homeroomTeacherId ?? 'none'} students=${c._count.students}`);
  }

  // All users with roles
  const users = await p.user.findMany({
    select: { userId: true, username: true, role: { select: { roleName: true } }, status: true },
    orderBy: { userId: 'asc' },
  });
  console.log(`\n=== All Users (${users.length}) ===`);
  for (const u2 of users) {
    console.log(`  userId=${u2.userId} username=${u2.username} role=${u2.role.roleName} status=${u2.status}`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
