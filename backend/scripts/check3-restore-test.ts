/**
 * check3-restore-test.ts
 * Tests the full restore procedure on dsssms_test_cleanup (NOT dsssms_db).
 * Verifies exact before/after counts for every affected table.
 *
 * Requires dsssms_test_cleanup to exist with schema applied:
 *   mysql> CREATE DATABASE IF NOT EXISTS dsssms_test_cleanup;
 *   Then: DATABASE_URL="mysql://USER:PASS@HOST/dsssms_test_cleanup" npx prisma migrate deploy
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const BACKUP_FILE = 'backup-20261013-162900-pre-cleanup.json';
const TEST_DB     = 'dsssms_test_cleanup';

const MODELS = [
  'role','user','administrator','director','viceDirector','teacher',
  'subject','classroom','teacherSubject','student','parent',
  'studentParentLink','studentEnrollment','userPermission','attendance',
  'gradeComponent','gradeEntry','gradeSubjectConfig','subjectFinalization',
  'classroomFinalization','academicReport','studentConduct','disciplineRecord',
  'notification','timetableEntry','assignment','assignmentSubmission',
  'promotionBatch','promotionEntry','studentIdCounter','systemSetting',
] as const;
type M = typeof MODELS[number];

function delegate(client: PrismaClient | Prisma.TransactionClient, m: M) {
  return (client as unknown as Record<M, {
    count: () => Promise<number>;
    deleteMany: () => Promise<unknown>;
    createMany: (a: { data: unknown[] }) => Promise<unknown>;
  }>)[m];
}

async function countAll(client: PrismaClient): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const m of MODELS) out[m] = await delegate(client, m).count();
  // Extra tables not in backup model
  out['auditLog']            = await client.auditLog.count();
  out['refreshToken']        = await client.refreshToken.count();
  out['parentTeacherMessage']= await client.parentTeacherMessage.count();
  return out;
}

async function main(): Promise<void> {
  const u        = new URL(process.env.DATABASE_URL!);
  const prodDb   = u.pathname.replace(/^\//, '');
  const host     = u.hostname;
  const port     = Number(u.port || 3306);
  const user     = decodeURIComponent(u.username);
  const password = decodeURIComponent(u.password);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  Check 3 — Restore test on isolated database: ' + TEST_DB);
  console.log('  Production DB (never touched): ' + prodDb);
  console.log('══════════════════════════════════════════════════════════════\n');

  if (prodDb === TEST_DB) {
    console.error('ERROR: TEST_DB equals production DB — aborting.');
    process.exit(1);
  }

  // ── Connect to test DB ───────────────────────────────────────────────────
  const testAdapter = new PrismaMariaDb({
    host, port, user, password,
    database: TEST_DB, connectionLimit: 5, allowPublicKeyRetrieval: true,
  });
  const testP = new PrismaClient({ adapter: testAdapter });

  // Verify connection
  try {
    await testP.$queryRaw`SELECT 1`;
    console.log(`✓ Connected to ${TEST_DB}\n`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`✗ Cannot connect to ${TEST_DB}: ${msg.slice(0, 120)}`);
    console.error(`\nTo create the test DB and apply schema:`);
    console.error(`  mysql -u ${user} -p -e "CREATE DATABASE IF NOT EXISTS ${TEST_DB}"`);
    console.error(`  set DATABASE_URL=mysql://${user}:PASSWORD@${host}:${port}/${TEST_DB}&& npx prisma migrate deploy`);
    await testP.$disconnect();
    process.exit(1);
  }

  // ── Load backup ──────────────────────────────────────────────────────────
  const bkpPath = path.join(process.cwd(), 'backups', BACKUP_FILE);
  const raw     = await fs.readFile(bkpPath, 'utf-8');
  const ISO_RE  = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  const bkp = JSON.parse(raw, (_k, v) =>
    typeof v === 'string' && ISO_RE.test(v) ? new Date(v) : v
  ) as { version: number; data: Record<string, Record<string, unknown>[]> };

  if (bkp.version !== 1) {
    console.error('Unexpected backup version: ' + bkp.version);
    process.exit(1);
  }

  // Backup counts
  const bkpCounts: Record<string, number> = {};
  for (const m of MODELS) bkpCounts[m] = bkp.data[m]?.length ?? 0;
  const bkpTotal = Object.values(bkpCounts).reduce((a, b) => a + b, 0);
  console.log(`Backup: ${MODELS.length} tables, ${bkpTotal} rows total`);

  // ── Step A: Count test DB BEFORE restore ─────────────────────────────────
  const beforeCounts = await countAll(testP);
  const beforeTotal  = Object.values(beforeCounts).reduce((a, b) => a + b, 0);
  console.log(`\nTest DB before restore: ${beforeTotal} rows total`);

  // ── Step B: Run restore transaction (exact same code as BackupService) ───
  console.log('\nRunning restore transaction on ' + TEST_DB + '...');

  const tableCounts: Record<string, number> = {};
  await testP.$transaction(async (tx) => {
    for (const m of [...MODELS].reverse()) {
      await delegate(tx as unknown as PrismaClient, m).deleteMany();
    }
    for (const m of MODELS) {
      const rows = bkp.data[m] ?? [];
      tableCounts[m] = rows.length;
      if (rows.length > 0) {
        await delegate(tx as unknown as PrismaClient, m).createMany({ data: rows });
      }
    }
  }, { timeout: 120_000 });

  console.log('✓ Restore transaction committed on ' + TEST_DB);

  // ── Step C: Count test DB AFTER restore ──────────────────────────────────
  const afterCounts = await countAll(testP);
  const afterTotal  = Object.values(afterCounts).reduce((a, b) => a + b, 0);

  // ── Step D: Connect to prod for comparison (read-only) ───────────────────
  const prodAdapter = new PrismaMariaDb({
    host, port, user, password,
    database: prodDb, connectionLimit: 3, allowPublicKeyRetrieval: true,
  });
  const prodP = new PrismaClient({ adapter: prodAdapter });
  const prodCounts = await countAll(prodP);
  await prodP.$disconnect();

  // ── Step E: Print comparison table ───────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  Table                      Backup  Before  After   Prod    Match');
  console.log('  ────────────────────────────────────────────────────────────────');

  let failures = 0;
  const allTables = [...MODELS, 'auditLog', 'refreshToken', 'parentTeacherMessage'] as const;

  for (const t of allTables) {
    const bN  = bkpCounts[t] ?? 0;
    const beN = beforeCounts[t] ?? 0;
    const afN = afterCounts[t] ?? 0;
    const prN = prodCounts[t] ?? 0;
    const inModel = MODELS.includes(t as M);

    let match: string;
    let ok: boolean;
    if (inModel) {
      // After restore should equal backup and prod
      ok = afN === bN && afN === prN;
      match = ok ? '✓' : `✗ (after=${afN} bkp=${bN} prod=${prN})`;
    } else {
      // Not in backup model — after restore should be unaffected (same as before)
      ok = afN === beN;
      match = ok ? `✓ (unchanged)` : `✗ (was=${beN} now=${afN})`;
    }
    if (!ok) failures++;

    console.log(
      `  ${ok?'✓':'✗'} ${t.padEnd(26)} ${String(bN).padStart(6)}  ${String(beN).padStart(6)}  ${String(afN).padStart(6)}  ${String(prN).padStart(6)}  ${match}`
    );
  }

  // ── Step F: Special checks ────────────────────────────────────────────────
  console.log('\n── Special checks ───────────────────────────────────────────────');

  // Admin user present after restore
  const adminAfter = await testP.user.findUnique({
    where: { userId: 1 },
    select: { userId: true, username: true, status: true },
  });
  console.log(`  Admin after restore: ${adminAfter ? `userId=${adminAfter.userId} username=${adminAfter.username} status=${adminAfter.status}` : 'NOT FOUND'}`);

  // Classrooms after restore
  const clsAfter = await testP.classroom.count();
  const homeroomAfter = await testP.classroom.count({ where: { homeroomTeacherId: { not: null } } });
  console.log(`  Classrooms: ${clsAfter}  with homeroom: ${homeroomAfter}`);

  // parentTeacherMessage — confirm NOT restored
  const ptmAfter = afterCounts['parentTeacherMessage'];
  console.log(`  parentTeacherMessage after restore: ${ptmAfter} (expected = same as before = ${beforeCounts['parentTeacherMessage']})`);
  console.log(`  → parentTeacherMessage is NOT in backup model — restore does not touch it`);

  // auditLog — confirm NOT restored
  const auditAfter = afterCounts['auditLog'];
  console.log(`  auditLog after restore: ${auditAfter} (expected = same as before = ${beforeCounts['auditLog']})`);
  console.log(`  → auditLog is NOT in backup model — restore does not touch it`);

  console.log('\n══════════════════════════════════════════════════════════════');
  if (failures === 0) {
    console.log('  ✓ ALL RESTORE COUNTS VERIFIED on ' + TEST_DB);
    console.log(`  After restore: ${afterTotal} rows in test DB`);
    console.log('  Restore is transactional, rollback-safe, and count-verified.');
  } else {
    console.log(`  ✗ ${failures} FAILURES — investigate before proceeding`);
  }
  console.log('══════════════════════════════════════════════════════════════\n');

  await testP.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
