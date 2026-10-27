/**
 * migrate-profile-pic-longtext.ts
 *
 * One-time migration: ALTER users.profilePicture from VARCHAR(500) to LONGTEXT.
 *
 * The profilePicture column was created as VARCHAR(500), which is far too small
 * for base64-encoded images (a 100KB image = ~135KB base64 = 135,000 chars).
 * LONGTEXT (up to 4GB) matches the SystemSetting.schoolLogo pattern already in use.
 *
 * Run: npx tsx scripts/migrate-profile-pic-longtext.ts
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

async function main(): Promise<void> {
  const u = new URL(process.env.DATABASE_URL!);
  const a = new PrismaMariaDb({
    host: u.hostname, port: Number(u.port || 3306),
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''), connectionLimit: 3, allowPublicKeyRetrieval: true,
  });
  const p = new PrismaClient({ adapter: a });

  // Check current type before altering
  const [col] = await p.$queryRaw<{ COLUMN_TYPE: string }[]>(
    Prisma.sql`SELECT COLUMN_TYPE FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
               AND COLUMN_NAME = 'profilePicture'`
  );

  if (!col) {
    console.log('Column users.profilePicture does not exist — nothing to do.');
    await p.$disconnect();
    return;
  }

  console.log(`Current type: ${col.COLUMN_TYPE}`);

  if (col.COLUMN_TYPE.toLowerCase() === 'longtext') {
    console.log('Column is already LONGTEXT — no migration needed.');
    await p.$disconnect();
    return;
  }

  console.log('Altering users.profilePicture VARCHAR(500) → LONGTEXT...');
  await p.$executeRaw`ALTER TABLE users MODIFY COLUMN profilePicture LONGTEXT NULL COMMENT 'URL or base64 data URL'`;

  // Verify
  const [after] = await p.$queryRaw<{ COLUMN_TYPE: string }[]>(
    Prisma.sql`SELECT COLUMN_TYPE FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
               AND COLUMN_NAME = 'profilePicture'`
  );
  console.log(`After migration: ${after?.COLUMN_TYPE}`);

  if (after?.COLUMN_TYPE.toLowerCase() === 'longtext') {
    console.log('✓ Migration successful — users.profilePicture is now LONGTEXT');
  } else {
    throw new Error(`Migration verification failed: expected longtext, got ${after?.COLUMN_TYPE}`);
  }

  await p.$disconnect();
}

main().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
