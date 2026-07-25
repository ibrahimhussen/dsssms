const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const adapter = new PrismaMariaDb({
  host: 'localhost',
  port: 3306,
  user: 'dsssms_user',
  password: 'mudasir',
  database: 'dsssms_db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const before = await prisma.user.findUnique({ where: { username: 'admin' } });
  console.log('Before:', {
    failedLoginAttempts: before?.failedLoginAttempts,
    lockedUntil: before?.lockedUntil,
  });

  const updated = await prisma.user.update({
    where: { username: 'admin' },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  console.log('After:', {
    failedLoginAttempts: updated.failedLoginAttempts,
    lockedUntil: updated.lockedUntil,
  });
}

main()
  .catch((err) => {
    console.error('Unlock failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });