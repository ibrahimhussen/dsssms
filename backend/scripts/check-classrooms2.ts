import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';
async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  const a = new PrismaMariaDb({ host:u.hostname, port:Number(u.port||3306), user:decodeURIComponent(u.username), password:decodeURIComponent(u.password), database:u.pathname.replace(/^\//,''), connectionLimit:3, allowPublicKeyRetrieval:true });
  const p = new PrismaClient({ adapter:a });

  // All classrooms with exact className values
  const cls = await p.classroom.findMany({ orderBy:{ classroomId:'asc' } });
  console.log('=== ALL CLASSROOMS ===');
  cls.forEach(c => console.log(`  id=${c.classroomId} className="${c.className}" section="${c.section}" year="${c.academicYear}"`));

  // Show exactly what gradeOptions the frontend would derive
  const gradeNames = [...new Set(cls.map(c => c.className))].sort();
  console.log('\n=== UNIQUE className VALUES (what appears in Grade dropdown) ===');
  gradeNames.forEach(g => console.log(`  "${g}"`));

  // For each grade, show whether sections appear for year="2026"
  console.log('\n=== SECTION FILTER SIMULATION (grade + year="2026") ===');
  for (const grade of gradeNames) {
    const sections = cls.filter(c => c.className === grade && c.academicYear === '2026');
    console.log(`  grade="${grade}" year="2026" → ${sections.length} section(s): ${sections.map(s=>s.section).join(', ') || 'NONE'}`);
  }
  console.log('\n=== SECTION FILTER SIMULATION (grade + year="2026/27") ===');
  for (const grade of gradeNames) {
    const sections = cls.filter(c => c.className === grade && c.academicYear === '2026/27');
    console.log(`  grade="${grade}" year="2026/27" → ${sections.length} section(s): ${sections.map(s=>s.section).join(', ') || 'NONE'}`);
  }

  // Show classrooms API response (what the frontend actually receives)
  const apiRows = await p.$queryRaw<{classroomId:number,className:string,section:string,academicYear:string}[]>(
    Prisma.sql`SELECT classroomId, className, section, academicYear FROM classrooms ORDER BY classroomId`
  );
  console.log('\n=== RAW DB VALUES (exact bytes) ===');
  apiRows.forEach(r => console.log(`  id=${r.classroomId} className=[${r.className}] section=[${r.section}] year=[${r.academicYear}]`));

  await p.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
