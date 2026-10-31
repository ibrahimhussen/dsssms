import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';
async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  const a = new PrismaMariaDb({ host:u.hostname, port:Number(u.port||3306), user:decodeURIComponent(u.username), password:decodeURIComponent(u.password), database:u.pathname.replace(/^\//,''), connectionLimit:3, allowPublicKeyRetrieval:true });
  const p = new PrismaClient({ adapter:a });
  const cls = await p.classroom.findMany({ select:{classroomId:true,className:true,section:true,academicYear:true,homeroomTeacherId:true}, orderBy:{classroomId:'asc'} });
  console.log('ALL CLASSROOMS:\n' + cls.map(c=>`  id=${c.classroomId} "${c.className}" section="${c.section}" year="${c.academicYear}" homeroom=${c.homeroomTeacherId}`).join('\n'));
  const gsc = await p.gradeSubjectConfig.findMany({ select:{className:true,academicYear:true,subjectId:true,id:true}, orderBy:[{className:'asc'},{academicYear:'asc'}] });
  console.log('\nGRADE SUBJECT CONFIGS:\n' + gsc.map(g=>`  id=${g.id} "${g.className}" year="${g.academicYear}" subjectId=${g.subjectId}`).join('\n'));
  const ss = await p.systemSetting.findFirst({ select:{currentAcademicYear:true,schoolName:true} });
  console.log('\nSYSTEM SETTINGS:', JSON.stringify(ss));
  const students = await p.student.findMany({ select:{studentId:true,firstName:true,lastName:true,classroomId:true,admissionNumber:true}, orderBy:{studentId:'asc'} });
  console.log('\nSTUDENTS:\n' + students.map(s=>`  id=${s.studentId} ${s.firstName} ${s.lastName} adm=${s.admissionNumber} classroomId=${s.classroomId}`).join('\n'));
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
