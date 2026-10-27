import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';
async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  const a = new PrismaMariaDb({ host:u.hostname, port:Number(u.port||3306), user:decodeURIComponent(u.username), password:decodeURIComponent(u.password), database:u.pathname.replace(/^\//,''), connectionLimit:3, allowPublicKeyRetrieval:true });
  const p = new PrismaClient({ adapter: a });
  const rows = await p.$queryRaw<{COLUMN_NAME:string;COLUMN_TYPE:string;CHARACTER_MAXIMUM_LENGTH:number|null}[]>(
    Prisma.sql`SELECT COLUMN_NAME, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'profilePicture'`
  );
  console.log('users.profilePicture column:', JSON.stringify(rows, (_k,v) => typeof v === 'bigint' ? v.toString() : v, 2));
  // Also check system_settings for comparison
  const logo = await p.$queryRaw<{COLUMN_NAME:string;COLUMN_TYPE:string;CHARACTER_MAXIMUM_LENGTH:number|null}[]>(
    Prisma.sql`SELECT COLUMN_NAME, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_settings' AND COLUMN_NAME = 'schoolLogo'`
  );
  console.log('system_settings.schoolLogo column:', JSON.stringify(logo, (_k,v) => typeof v === 'bigint' ? v.toString() : v, 2));
  // Check ALL users columns to see what actually exists
  const allCols = await p.$queryRaw<{COLUMN_NAME:string;COLUMN_TYPE:string}[]>(
    Prisma.sql`SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' ORDER BY ORDINAL_POSITION`
  );
  console.log('All users columns:', allCols.map(c => `${c.COLUMN_NAME}: ${c.COLUMN_TYPE}`).join('\n'));
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
