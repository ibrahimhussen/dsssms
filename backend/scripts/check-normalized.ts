/**
 * Verifies that after normalizeClassName is applied in toClassroomSummaryDto,
 * all API consumers receive consistent "Grade N" className values.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

function normalizeClassName(rawName: string): string {
  const match = rawName.match(/(?:Grade\s*)?(\d+)/i);
  return match ? `Grade ${match[1]}` : rawName;
}

async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  const a = new PrismaMariaDb({ host:u.hostname, port:Number(u.port||3306), user:decodeURIComponent(u.username), password:decodeURIComponent(u.password), database:u.pathname.replace(/^\//,''), connectionLimit:3, allowPublicKeyRetrieval:true });
  const p = new PrismaClient({ adapter:a });

  const classrooms = await p.classroom.findMany({ orderBy:[{academicYear:'desc'},{className:'asc'},{section:'asc'}] });
  
  console.log('=== NORMALIZED className values (what API will now return) ===');
  classrooms.forEach(c => {
    const norm = normalizeClassName(c.className);
    const changed = norm !== c.className;
    console.log(`  [${c.className}] → [${norm}] ${changed ? '← CHANGED' : '(unchanged)'}`);
  });

  const uniqueNormalized = [...new Set(classrooms.map(c => normalizeClassName(c.className)))].sort();
  console.log('\n=== Unique normalized values (what gradeOptions dropdown will show) ===');
  uniqueNormalized.forEach(g => console.log(`  "${g}"`));

  // Verify filteredClassrooms will work for "grade 11" after normalization
  const grade11Classrooms = classrooms
    .map(c => ({ ...c, normalizedName: normalizeClassName(c.className) }))
    .filter(c => c.normalizedName === 'Grade 11' && c.academicYear === '2026');
  console.log(`\n=== Sections for "Grade 11" (normalized) year="2026" ===`);
  console.log(`  Found: ${grade11Classrooms.length} classrooms`);
  grade11Classrooms.forEach(c => console.log(`  → id=${c.classroomId} section="${c.section}"`));

  // Verify GSC lookup will work
  const gsc11 = await p.gradeSubjectConfig.findMany({ where:{ className:'Grade 11', academicYear:'2026' } });
  console.log(`\n=== GradeSubjectConfig for "Grade 11" year="2026" ===`);
  console.log(`  Found: ${gsc11.length} subjects configured`);

  await p.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
