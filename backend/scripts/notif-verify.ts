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

  // Inspect notifications 104, 105, 119 fully
  console.log('\n=== FLAGGED NOTIFICATIONS 104, 105, 119 ===');
  const flagged = await prisma.notification.findMany({
    where: { notificationId: { in: [104, 105, 119] } },
    select: {
      notificationId: true, category: true, title: true, message: true,
      recipientUserId: true, senderUserId: true, studentId: true,
      status: true, sentDate: true,
    },
  });
  for (const n of flagged) {
    console.log(`  notifId=${n.notificationId}`);
    console.log(`    recipient userId=${n.recipientUserId}`);
    console.log(`    sender   userId=${n.senderUserId}`);
    console.log(`    studentId=${n.studentId}`);
    console.log(`    category=${n.category} status=${n.status}`);
    console.log(`    title="${n.title}"`);
    console.log(`    message="${n.message.slice(0, 100)}..."`);
  }

  // Confirm who userId=2 is
  console.log('\n=== userId=2 identity ===');
  const u2 = await prisma.user.findUnique({
    where: { userId: 2 },
    include: { teacher: { select: { teacherId: true, firstName: true, lastName: true } } },
  });
  console.log(`  userId=2 username=${u2?.username} role has teacher=${u2?.teacher?.firstName} ${u2?.teacher?.lastName} (teacherId=${u2?.teacher?.teacherId})`);
  console.log(`  Is this the demo teacher abebe.kebede? ${u2?.username === 'abebe.kebede' ? 'YES' : 'NO'}`);

  // ALL notifications where recipient=2 (demo teacher inbox)
  console.log('\n=== ALL notifications received by userId=2 (demo teacher) ===');
  const allToTeacher = await prisma.notification.findMany({
    where: { recipientUserId: 2 },
    select: { notificationId: true, senderUserId: true, studentId: true, title: true, category: true, status: true },
    orderBy: { notificationId: 'asc' },
  });
  console.log(`  Total: ${allToTeacher.length}`);
  for (const n of allToTeacher) {
    const demoStudent = n.studentId !== null && [1,2,3,4,5,6].includes(n.studentId ?? -1);
    const demoSender  = n.senderUserId !== null && [5,6,7,8,9,10,11,12,13,14,15,16].includes(n.senderUserId ?? -1);
    console.log(`  notifId=${n.notificationId} sender=${n.senderUserId}(demoSender=${demoSender}) studentId=${n.studentId}(demoStudent=${demoStudent}) cat=${n.category} title="${n.title}"`);
  }

  // Also check ALL notifications sent by demo teacher (userId=2)
  console.log('\n=== Notifications SENT by userId=2 (demo teacher) ===');
  const sentByTeacher = await prisma.notification.count({ where: { senderUserId: 2 } });
  console.log(`  Count: ${sentByTeacher}`);

  // Notifications where recipient=2 AND sender is NOT demo AND studentId is NOT demo
  console.log('\n=== Notifications to demo teacher from REAL users about REAL students ===');
  const realToTeacher = await prisma.notification.count({
    where: {
      recipientUserId: 2,
      senderUserId: { notIn: [5,6,7,8,9,10,11,12,13,14,15,16] },
      studentId: { notIn: [1,2,3,4,5,6] },
    },
  });
  console.log(`  Count: ${realToTeacher} (these would be legitimate messages to the demo teacher that must be preserved)`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
