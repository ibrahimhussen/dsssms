/**
 * check1-audit-backup.ts
 * Creates a separate JSON backup of auditLog and refreshToken rows.
 * These tables are NOT covered by the main backup model.
 * READ ONLY — writes only to the backups/ directory.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

async function main(): Promise<void> {
  const u = new URL(process.env.DATABASE_URL!);
  const a = new PrismaMariaDb({
    host: u.hostname, port: Number(u.port || 3306),
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''), connectionLimit: 3, allowPublicKeyRetrieval: true,
  });
  const p = new PrismaClient({ adapter: a });

  console.log('Exporting auditLog and refreshToken to separate backup file...');

  const auditLogs     = await p.auditLog.findMany({ orderBy: { id: 'asc' } });
  const refreshTokens = await p.refreshToken.findMany({ orderBy: { createdAt: 'asc' } });

  console.log(`  auditLog rows     : ${auditLogs.length}`);
  console.log(`  refreshToken rows : ${refreshTokens.length}`);

  const now      = new Date();
  const stamp    = now.toISOString().replace(/[-:]/g,'').replace(/\..+/,'').replace('T','-');
  const fileName = `backup-${stamp}-excluded-tables.json`;
  const outPath  = path.join(process.cwd(), 'backups', fileName);

  const contents = {
    version:   1,
    createdAt: now.toISOString(),
    note:      'Separate backup of tables excluded from the main BackupService model (auditLog, refreshToken). NOT restored by the standard restore endpoint.',
    data:      { auditLog: auditLogs, refreshToken: refreshTokens },
  };

  await fs.mkdir(path.join(process.cwd(), 'backups'), { recursive: true });
  // BigInt replacer: auditLog.id is BigInt — serialise as string
  const serialiser = (_k: string, v: unknown) =>
    typeof v === 'bigint' ? v.toString() : v;
  await fs.writeFile(outPath, JSON.stringify(contents, serialiser, 2), 'utf-8');
  const stat = await fs.stat(outPath);

  console.log(`\n✓ Written: backups/${fileName}`);
  console.log(`  Size    : ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`  auditLog: ${auditLogs.length} rows`);
  console.log(`  refreshToken: ${refreshTokens.length} rows`);

  // Verify the file is valid JSON and counts match
  const raw   = await fs.readFile(outPath, 'utf-8');
  const check = JSON.parse(raw) as typeof contents;
  const auditOk   = check.data.auditLog.length     === auditLogs.length;
  const tokenOk   = check.data.refreshToken.length === refreshTokens.length;
  console.log(`\n  Verification:`);
  console.log(`    auditLog    : written=${check.data.auditLog.length}    source=${auditLogs.length}    match=${auditOk}`);
  console.log(`    refreshToken: written=${check.data.refreshToken.length} source=${refreshTokens.length} match=${tokenOk}`);

  if (!auditOk || !tokenOk) { console.error('  ✗ COUNT MISMATCH'); process.exit(1); }
  console.log('  ✓ Both counts verified');

  // Recovery note
  console.log('\n  Recovery: To restore these tables after cleanup, run the companion');
  console.log('  restore script: npx tsx scripts/check1-restore-excluded.ts');
  console.log('  That script reads this file and reinserts rows into the live DB.');
  console.log('\n  NOTE: refreshToken rows reference userId values that will be deleted.');
  console.log('  Restoring refreshToken after user deletion would create FK violations.');
  console.log('  refreshToken records are SESSION DATA — they are intentionally ephemeral.');
  console.log('  Their loss has no academic or operational impact.');
  console.log('  auditLog rows reference userId via SET NULL — restoring them is safe');
  console.log('  but the userId links will be NULL after user deletion.');

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
