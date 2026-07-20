import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'Admin@12345'; // Meets the password policy; CHANGE on first login.

async function main(): Promise<void> {
  console.log('Seeding roles...');

  const roleNames = Object.values(RoleName);
  for (const roleName of roleNames) {
    await prisma.role.upsert({
      where: { roleName },
      update: {},
      create: { roleName },
    });
  }

  console.log('Seeding default administrator account...');

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { roleName: RoleName.ADMIN } });

  const existingAdmin = await prisma.user.findUnique({ where: { username: DEFAULT_ADMIN_USERNAME } });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);

    const adminUser = await prisma.user.create({
      data: {
        username: DEFAULT_ADMIN_USERNAME,
        email: 'admin@dinsho-secondary.edu.et',
        passwordHash,
        roleId: adminRole.roleId,
        administrator: {
          create: { firstName: 'System', lastName: 'Administrator' },
        },
      },
    });

    console.log(`Created default admin user (userId=${adminUser.userId}).`);
    console.log(`  username: ${DEFAULT_ADMIN_USERNAME}`);
    console.log(`  password: ${DEFAULT_ADMIN_PASSWORD}  <-- change this immediately after first login`);
  } else {
    console.log('Default admin already exists, skipping.');
  }

  console.log('Seeding complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
