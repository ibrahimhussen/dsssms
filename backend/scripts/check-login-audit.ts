/**
 * check-login-audit.ts — READ ONLY.
 * Checks audit log events for dasi.shallo (userId=113) without printing
 * any sensitive data.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

async function main(): Promise<void> {
  const u = new URL(process.env.DATABASE_URL!);
  const adapter = new PrismaMariaDb({
    host: u.hostname, port: Number(u.port || 3306),
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''), connectionLimit: 3, allowPublicKeyRetrieval: true,
  });
  const p = new PrismaClient({ adapter });

  const TARGET_USER_ID = 113; // dasi.shallo

  // Audit events for this user
  const events = await p.auditLog.findMany({
    where: { userId: TARGET_USER_ID },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true, action: true, entity: true, entityId: true,
      ipAddress: true, createdAt: true,
      // metadata may contain role/username info — print action only, not secrets
    },
  });

  console.log(`=== Audit log for userId=${TARGET_USER_ID} (dasi.shallo) — last ${events.length} events ===`);
  if (events.length === 0) {
    console.log('  No audit events found.');
  }
  for (const e of events) {
    console.log(`  ${e.createdAt.toISOString()}  action=${e.action}  entity=${e.entity ?? '-'}  entityId=${e.entityId ?? '-'}  ip=${e.ipAddress ?? '-'}`);
  }

  // Also check if there are events from admin that created this account
  const creationEvents = await p.auditLog.findMany({
    where: { action: 'STAFF_ACCOUNT_CREATED', entity: 'User', entityId: String(TARGET_USER_ID) },
    orderBy: { createdAt: 'asc' },
    select: { id: true, action: true, createdAt: true, userId: true, ipAddress: true },
  });
  console.log(`\n=== Account creation events for entityId=${TARGET_USER_ID} ===`);
  for (const e of creationEvents) {
    console.log(`  ${e.createdAt.toISOString()}  action=${e.action}  performedBy=userId:${e.userId}  ip=${e.ipAddress ?? '-'}`);
  }

  // Password reset events
  const resetEvents = await p.auditLog.findMany({
    where: { action: 'USER_PASSWORD_RESET', entity: 'User', entityId: String(TARGET_USER_ID) },
    orderBy: { createdAt: 'desc' },
    select: { id: true, action: true, createdAt: true, userId: true },
  });
  console.log(`\n=== Password reset events for userId=${TARGET_USER_ID} ===`);
  if (resetEvents.length === 0) console.log('  None — password has never been reset by admin.');
  for (const e of resetEvents) {
    console.log(`  ${e.createdAt.toISOString()}  action=${e.action}  performedBy=userId:${e.userId}`);
  }

  // Check when the user was created (createdAt from DB)
  const user = await p.user.findUnique({
    where: { userId: TARGET_USER_ID },
    select: { userId: true, username: true, createdAt: true, updatedAt: true, isTemporaryPassword: true },
  });
  console.log(`\n=== User record timestamps ===`);
  console.log(`  createdAt        : ${user?.createdAt.toISOString()}`);
  console.log(`  updatedAt        : ${user?.updatedAt.toISOString()}`);
  console.log(`  isTemporaryPwd   : ${user?.isTemporaryPassword}`);
  console.log(`  Note: isTemporaryPassword=true means the admin-generated temporary`);
  console.log(`        password has never been changed by the user.`);

  await p.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
