/**
 * check-user-login.ts — READ ONLY diagnostic for login failures.
 * Checks user existence, status, role, account-lock state, and
 * password hash FORMAT (never prints the actual hash or password).
 */
import { PrismaClient } from '@prisma/client';
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

  const usernamesToCheck = ['dasi.shallo', 'dasi.shallo2', 'admin'];

  for (const username of usernamesToCheck) {
    const user = await p.user.findUnique({
      where: { username },
      select: {
        userId: true,
        username: true,
        status: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        lastLoginAt: true,
        isTemporaryPassword: true,
        roleId: true,
        // Only inspect hash metadata, never print the value:
        passwordHash: true,
        role: { select: { roleName: true } },
        teacher: { select: { teacherId: true, firstName: true, lastName: true } },
      },
    });

    console.log(`\n=== User: "${username}" ===`);
    if (!user) {
      console.log('  NOT FOUND in database');
      continue;
    }

    console.log(`  userId           : ${user.userId}`);
    console.log(`  status           : ${user.status}`);
    console.log(`  role             : ${user.role.roleName}`);
    console.log(`  failedLogins     : ${user.failedLoginAttempts}`);
    console.log(`  lockedUntil      : ${user.lockedUntil ?? 'null (not locked)'}`);
    console.log(`  lastLoginAt      : ${user.lastLoginAt ?? 'never'}`);
    console.log(`  isTemporary      : ${user.isTemporaryPassword}`);
    console.log(`  teacher profile  : ${user.teacher ? `${user.teacher.firstName} ${user.teacher.lastName} (id=${user.teacher.teacherId})` : 'none'}`);

    // Check password hash format WITHOUT printing it
    const hash = user.passwordHash;
    const isBcrypt = hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
    const hashPrefix = hash.slice(0, 7); // e.g. "$2b$12$" — safe to show, no secret material
    const hashLength = hash.length;
    console.log(`  passwordHash     : format=${isBcrypt ? 'bcrypt' : 'UNKNOWN'} prefix="${hashPrefix}" length=${hashLength}`);

    if (!isBcrypt) {
      console.log('  ⚠ PASSWORD HASH IS NOT bcrypt — login will always fail with verifyPassword()');
    }
    if (isBcrypt) {
      // Extract cost factor
      const costMatch = hash.match(/^\$2[aby]\$(\d+)\$/);
      const cost = costMatch ? costMatch[1] : 'unknown';
      console.log(`  bcrypt cost      : ${cost}`);
    }
  }

  // Also summarise all teacher accounts to spot any pattern
  console.log('\n=== ALL TEACHER ACCOUNTS ===');
  const teacherRole = await p.role.findUnique({ where: { roleName: 'TEACHER' } });
  if (teacherRole) {
    const teachers = await p.user.findMany({
      where: { roleId: teacherRole.roleId },
      select: {
        userId: true, username: true, status: true, failedLoginAttempts: true,
        lockedUntil: true, isTemporaryPassword: true, passwordHash: true,
        teacher: { select: { firstName: true, lastName: true } },
      },
      orderBy: { userId: 'asc' },
    });
    for (const t of teachers) {
      const isBcrypt = t.passwordHash.startsWith('$2a$') || t.passwordHash.startsWith('$2b$') || t.passwordHash.startsWith('$2y$');
      const status = t.status === 'ACTIVE' ? '✓ ACTIVE' : `✗ ${t.status}`;
      const locked = t.lockedUntil && t.lockedUntil > new Date() ? `LOCKED until ${t.lockedUntil.toISOString()}` : 'not locked';
      const hashFmt = isBcrypt ? `bcrypt(${t.passwordHash.match(/^\$2[aby]\$(\d+)\$/)?.[1] ?? '?'})` : 'NOT-BCRYPT ⚠';
      console.log(`  id=${t.userId} ${t.username.padEnd(22)} ${status} ${locked} hash=${hashFmt} tempPwd=${t.isTemporaryPassword} name="${t.teacher?.firstName ?? '?'} ${t.teacher?.lastName ?? '?'}"`);
    }
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
