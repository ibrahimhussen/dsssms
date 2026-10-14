/**
 * restore-to-test.ts
 * Restores the pre-cleanup backup into dsssms_test_cleanup (isolated DB).
 * Creates the test DB and all tables via Prisma migrations first,
 * then restores the backup data using the same BackupService logic.
 *
 * Usage: npx tsx scripts/restore-to-test.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const SOURCE_BACKUP = 'backup-20261013-160404-pre-cleanup.json';

const MODELS_IN_INSERT_ORDER = [
  'role', 'user', 'administrator', 'director', 'viceDirector', 'teacher',
  'subject', 'classroom', 'teacherSubject', 'student', 'parent',
  'studentParentLink', 'studentEnrollment', 'userPermission', 'attendance',
  'gradeComponent', 'gradeEntry', 'gradeSubjectConfig', 'subjectFinalization',
  'classroomFinalization', 'academicReport', 'studentConduct', 'disciplineRecord',
  'notification', 'timetableEntry', 'assignment', 'assignmentSubmission',
  'promotionBatch', 'promotionEntry', 'studentIdCounter', 'systemSetting',
] as const;

type ModelName = typeof MODELS_IN_INSERT_ORDER[number];

// Parse the production DATABASE_URL to get connection params
const prodUrl = new URL(process.env.DATABASE_URL!);
const host     = prodUrl.hostname;
const port     = Number(prodUrl.port || 3306);
const user     = decodeURIComponent(prodUrl.username);
const password = decodeURIComponent(prodUrl.password);
const TEST_DB  = 'dsssms_test_cleanup';

async function main(): Promise<void> {
  console.log('=== Restore backup to isolated test database ===\n');
  console.log(`Source backup : ${SOURCE_BACKUP}`);
  console.log(`Target DB     : ${TEST_DB}`);
  console.log(`Host          : ${host}:${port}`);
  console.log(`User          : ${user}\n`);

  // Read backup file
  const backupPath = path.join(process.cwd(), 'backups', SOURCE_BACKUP);
  const raw = await fs.readFile(backupPath, 'utf-8');
  const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents = JSON.parse(raw, (_k, v) => (typeof v === 'string' && ISO_RE.test(v) ? new Date(v) : v)) as any;
  console.log(`Backup version: ${contents.version}  created: ${contents.createdAt}`);

  // Connect to test DB (must already exist with schema applied)
  const testAdapter = new PrismaMariaDb({ host, port, user, password, database: TEST_DB, connectionLimit: 5 });
  const prisma = new PrismaClient({ adapter: testAdapter });

  // Verify test DB is reachable
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).$queryRaw`SELECT 1`;
    console.log(`✓ Connected to ${TEST_DB}\n`);
  } catch (e) {
    console.error(`✗ Cannot connect to ${TEST_DB}. Please create it and run migrations first:`);
    console.error(`  mysql -u ${user} -p -e "CREATE DATABASE IF NOT EXISTS ${TEST_DB}"`);
    console.error(`  DATABASE_URL="mysql://${user}:***@${host}:${port}/${TEST_DB}" npx prisma migrate deploy`);
    throw e;
  }

  // Wipe test DB (reverse order) then restore
  console.log('Clearing test DB tables (reverse order)...');
  await prisma.$transaction(async (tx) => {
    for (const model of [...MODELS_IN_INSERT_ORDER].reverse()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any)[model].deleteMany();
    }
    console.log('  All tables cleared.\n');

    console.log('Restoring backup data...');
    let totalRestored = 0;
    for (const model of MODELS_IN_INSERT_ORDER) {
      const rows: Record<string, unknown>[] = contents.data[model] ?? [];
      if (rows.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (tx as any)[model].createMany({ data: rows });
      }
      totalRestored += rows.length;
      console.log(`  ${model.padEnd(25)}: ${rows.length} rows restored`);
    }
    console.log(`\n  Total rows restored: ${totalRestored}`);
  }, { timeout: 120_000 });

  // Verify counts match backup
  console.log('\nVerifying restored counts match backup...');
  let allMatch = true;
  for (const model of MODELS_IN_INSERT_ORDER) {
    const expected = (contents.data[model] as unknown[]).length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actual   = await (prisma as any)[model].count();
    const ok = expected === actual;
    if (!ok) allMatch = false;
    if (!ok || expected > 0) {
      console.log(`  ${ok ? '✓' : '✗'} ${model.padEnd(25)}: expected=${expected} actual=${actual}${ok ? '' : ' ← MISMATCH'}`);
    }
  }

  if (allMatch) {
    console.log('\n✓ All counts match. Backup restored successfully to test database.\n');
  } else {
    console.error('\n✗ Count mismatches found. Investigate before proceeding.\n');
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error('Restore failed:', e); process.exit(1); });
