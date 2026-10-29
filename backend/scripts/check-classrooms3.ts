import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';
async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  const a = new PrismaMariaDb({ host:u.hostname, port:Number(u.port||3306), user:decodeURIComponent(u.username), password:decodeURIComponent(u.password), database:u.pathname.replace(/^\//,''), connectionLimit:3, allowPublicKeyRetrieval:true });
  const p = new PrismaClient({ adapter:a });

  const total = await p.classroom.count();
  console.log('Total classrooms:', total);

  // Simulate exact API query — limit=100, same ordering as classroom.service.ts
  const cls = await p.classroom.findMany({
    take: 100, skip: 0,
    orderBy: [{ academicYear:'desc' }, { className:'asc' }, { section:'asc' }],
    include: { homeroomTeacher: true, _count: { select: { students: true } } }
  });
  console.log('With limit=100:', cls.length);
  cls.forEach(c => console.log(`  id=${c.classroomId} className=[${c.className}] section=[${c.section}] year=[${c.academicYear}]`));

  // What does extractClassName do to "grade 11"?
  function extractClassName(rawName: string): string {
    const match = rawName.match(/(?:Grade\s*)?(\d+)/i);
    return match ? `Grade ${match[1]}` : rawName;
  }
  console.log('\nextractClassName results:');
  ['grade 11','Grade 9','GRADE 10','grade 12'].forEach(g =>
    console.log(`  "${g}" → "${extractClassName(g)}"`)
  );

  // Simulate what generateGradeRegister does: normalise then query
  console.log('\nClassroom query simulations (what backend does for grade-wide):');
  for (const rawGrade of ['grade 11','Grade 9','GRADE 10','grade 12']) {
    const normalized = extractClassName(rawGrade);
    const found = await p.classroom.findMany({ where:{ className: normalized, academicYear:'2026' } });
    console.log(`  "${rawGrade}" normalizes to "${normalized}": ${found.length} classrooms found`);
    if (found.length === 0) {
      // Try case-insensitive
      const foundCI = await p.classroom.findMany({ where:{ className:{ contains: normalized }, academicYear:'2026' } });
      console.log(`    (contains search): ${foundCI.length} found`);
    }
  }

  // Check GradeSubjectConfig for grade 11
  const gsc11 = await p.gradeSubjectConfig.findMany({ where:{ className: { contains:'11' } } });
  console.log('\nGradeSubjectConfig for grade 11:', gsc11.map(g => `className=[${g.className}] year=[${g.academicYear}] subjectId=${g.subjectId}`).join(', '));

  await p.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
