import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';
async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  const a = new PrismaMariaDb({ host:u.hostname, port:Number(u.port||3306), user:decodeURIComponent(u.username), password:decodeURIComponent(u.password), database:u.pathname.replace(/^\//,''), connectionLimit:3, allowPublicKeyRetrieval:true });
  const p = new PrismaClient({ adapter:a });

  // listConfiguredGrades response — what populates gradeOptions in AcademicRegisterPage
  const rows = await p.gradeSubjectConfig.groupBy({
    by: ['className','academicYear'],
    _count: { id: true },
    orderBy: [{ academicYear:'desc' }, { className:'asc' }]
  });
  console.log('=== listConfiguredGrades ===');
  rows.forEach(r => console.log(`  className=[${r.className}] year=[${r.academicYear}] subjects=${r._count.id}`));

  // What GSC returns when grade="grade 11", year="2026" (raw value from classrooms)
  const gscLower = await p.gradeSubjectConfig.findMany({ where:{ className:'grade 11', academicYear:'2026' } });
  console.log('\nGSC for className="grade 11" year="2026":', gscLower.length, 'rows (MySQL CI collation handles case)');

  const gscTitle = await p.gradeSubjectConfig.findMany({ where:{ className:'Grade 11', academicYear:'2026' } });
  console.log('GSC for className="Grade 11" year="2026":', gscTitle.length, 'rows');

  // The filteredClassrooms uses exact JS === comparison — check what className classroom API returns
  console.log('\n=== KEY: Do classroom.className and GSC.className use same casing? ===');
  const classrooms11 = await p.classroom.findMany({ where:{ className:{ contains:'11' } } });
  console.log('classroom.className values:', classrooms11.map(c => `[${c.className}]`).join(', '));
  const gsc11 = await p.gradeSubjectConfig.findMany({ where:{ className:{ contains:'11' } } });
  const gsc11Names = [...new Set(gsc11.map(g => g.className))];
  console.log('gradeSubjectConfig.className values:', gsc11Names.map(n => `[${n}]`).join(', '));

  console.log('\n=== CONCLUSION ===');
  console.log('Classroom className for grade 11:', classrooms11[0]?.className);
  console.log('GSC className for grade 11:', gsc11Names[0]);
  console.log('Match with ===:', classrooms11[0]?.className === gsc11Names[0]);

  await p.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
