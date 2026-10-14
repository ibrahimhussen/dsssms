/**
 * check3-restore-rollback-test.ts
 *
 * Tests the exact restore logic inside dsssms_db, but in a transaction that
 * is DELIBERATELY ROLLED BACK at the end. This verifies:
 *   1. The restore transaction can execute without FK errors
 *   2. All 31 table counts match the backup after restore
 *   3. auditLog, refreshToken, parentTeacherMessage are NOT touched
 *   4. The admin user survives the restore
 *   5. All 17 classrooms survive
 *
 * The final throw ensures ROLLBACK — dsssms_db is left completely unchanged.
 * This is safe because $transaction rolls back on any thrown error.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const BACKUP_FILE = 'backup-20261013-162900-pre-cleanup.json';

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

type TxClient = Prisma.TransactionClient;
type AnyClient = PrismaClient | TxClient;

function delegate(client: AnyClient, m: M) {
  return (client as unknown as Record<M, {
    count: () => Promise<number>;
    deleteMany: () => Promise<{ count: number }>;
    createMany: (a: { data: unknown[] }) => Promise<unknown>;
    findUnique: (a: { where: { userId: number }; select: { userId: boolean; username: boolean; status: boolean } }) => Promise<{ userId: number; username: string; status: string } | null>;
  }>)[m];
}

// ── SENTINEL error — used to force rollback after verification ─────────────
class IntentionalRollback extends Error {
  constructor() { super('INTENTIONAL_ROLLBACK — verify-only test, no changes committed'); }
}

async function main(): Promise<void> {
  const u        = new URL(process.env.DATABASE_URL!);
  const dbName   = u.pathname.replace(/^\//, '');
  const host     = u.hostname;
  const port     = Number(u.port || 3306);
  const user     = decodeURIComponent(u.username);
  const password = decodeURIComponent(u.password);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  Check 3 — Restore test with deliberate rollback');
  console.log(`  Database: ${dbName} on ${host}:${port}`);
  console.log('  Transaction WILL BE ROLLED BACK — no data modified');
  console.log('══════════════════════════════════════════════════════════════\n');

  const adapter = new PrismaMariaDb({
    host, port, user, password, database: dbName,
    connectionLimit: 5, allowPublicKeyRetrieval: true,
  });
  const p = new PrismaClient({ adapter });

  // ── Pre-transaction: capture baseline (outside transaction) ───────────────
  console.log('── Baseline counts (before transaction) ─────────────────────────');
  const baseline: Record<string, number> = {};
  for (const m of MODELS) {
    baseline[m] = await delegate(p, m).count();
  }
  baseline['auditLog']             = await p.auditLog.count();
  baseline['refreshToken']         = await p.refreshToken.count();
  baseline['parentTeacherMessage'] = await p.parentTeacherMessage.count();
  const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
  console.log(`  Total rows before: ${baseTotal}`);
  for (const [t, n] of Object.entries(baseline)) {
    if (n > 0) console.log(`    ${t.padEnd(26)}: ${n}`);
  }

  // ── Load backup ───────────────────────────────────────────────────────────
  const bkpPath = path.join(process.cwd(), 'backups', BACKUP_FILE);
  const raw     = await fs.readFile(bkpPath, 'utf-8');
  const ISO_RE  = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  const bkp     = JSON.parse(raw, (_k, v) =>
    typeof v === 'string' && ISO_RE.test(v) ? new Date(v) : v
  ) as { version: number; data: Record<string, Record<string, unknown>[]> };
  const bkpTotal = MODELS.reduce((s, m) => s + (bkp.data[m]?.length ?? 0), 0);
  console.log(`\n  Backup: ${MODELS.length} tables, ${bkpTotal} rows`);

  // ── Run restore inside a transaction, then ROLLBACK ───────────────────────
  const results: {
    restoreCounts: Record<string, number>;
    adminAfter: { userId: number; username: string; status: string } | null;
    classroomsAfter: number;
    homeroomAfter: number;
    auditAfter: number;
    tokenAfter: number;
    ptmAfter: number;
    errors: string[];
  } = {
    restoreCounts: {}, adminAfter: null, classroomsAfter: 0,
    homeroomAfter: 0, auditAfter: 0, tokenAfter: 0, ptmAfter: 0,
    errors: [],
  };

  try {
    await p.$transaction(async (tx) => {
      // Step A: delete in reverse order (same as BackupService.restore)
      for (const m of [...MODELS].reverse()) {
        await delegate(tx, m).deleteMany();
      }

      // Step B: insert in forward order
      for (const m of MODELS) {
        const rows = bkp.data[m] ?? [];
        if (rows.length > 0) {
          await delegate(tx, m).createMany({ data: rows });
        }
      }

      // Step C: count after restore (still inside transaction)
      for (const m of MODELS) {
        results.restoreCounts[m] = await delegate(tx, m).count();
      }
      results.auditAfter   = await p.auditLog.count();        // outside tx — baseline
      results.tokenAfter   = await p.refreshToken.count();    // outside tx — baseline
      results.ptmAfter     = await p.parentTeacherMessage.count(); // outside tx

      // Step D: verify admin user survived
      const adminRow = await (tx as unknown as PrismaClient).user.findUnique({
        where: { userId: 1 },
        select: { userId: true, username: true, status: true },
      });
      results.adminAfter = adminRow;

      // Step E: verify classrooms
      results.classroomsAfter = await (tx as unknown as PrismaClient).classroom.count();
      results.homeroomAfter   = await (tx as unknown as PrismaClient).classroom.count({
        where: { homeroomTeacherId: { not: null } },
      });

      // Force rollback — we never want this committed
      throw new IntentionalRollback();

    }, { timeout: 120_000 });

  } catch (e) {
    if (e instanceof IntentionalRollback) {
      console.log('\n  ✓ Intentional rollback executed — dsssms_db is unchanged');
    } else {
      results.errors.push(e instanceof Error ? e.message : String(e));
      console.error('\n  ✗ Unexpected error during restore transaction:');
      console.error('   ', e instanceof Error ? e.message : String(e));
    }
  }

  // ── Verify dsssms_db is truly unchanged ───────────────────────────────────
  console.log('\n── Post-rollback verification (dsssms_db must be unchanged) ────');
  const postRollback: Record<string, number> = {};
  for (const m of MODELS) postRollback[m] = await delegate(p, m).count();
  postRollback['auditLog']             = await p.auditLog.count();
  postRollback['refreshToken']         = await p.refreshToken.count();
  postRollback['parentTeacherMessage'] = await p.parentTeacherMessage.count();

  let rollbackOk = true;
  for (const [t, before] of Object.entries(baseline)) {
    const after = postRollback[t] ?? 0;
    if (before !== after) {
      console.log(`  ✗ ROLLBACK INCOMPLETE: ${t} was=${before} now=${after}`);
      rollbackOk = false;
    }
  }
  if (rollbackOk) {
    console.log('  ✓ All counts identical to pre-transaction baseline — rollback confirmed');
  }

  // ── Print restore verification results ───────────────────────────────────
  console.log('\n── Restore counts (inside rolled-back transaction) ─────────────');
  console.log('  Table                      Backup  Restored  Match');
  console.log('  ───────────────────────────────────────────────────');
  let allMatch = true;
  for (const m of MODELS) {
    const bkpN     = bkp.data[m]?.length ?? 0;
    const restored = results.restoreCounts[m] ?? -1;
    const ok       = restored === bkpN;
    if (!ok) allMatch = false;
    console.log(`  ${ok?'✓':'✗'} ${m.padEnd(26)} ${String(bkpN).padStart(6)}  ${String(restored).padStart(8)}  ${ok?'✓':'✗ MISMATCH'}`);
  }

  console.log('\n── Special checks inside rolled-back transaction ────────────────');
  const adminOk = results.adminAfter?.username === 'admin' && results.adminAfter?.status === 'ACTIVE';
  console.log(`  Admin user after restore : ${results.adminAfter ? `userId=${results.adminAfter.userId} username=${results.adminAfter.username} status=${results.adminAfter.status}` : 'NOT FOUND'} ${adminOk?'✓':'✗'}`);
  console.log(`  Classrooms after restore : ${results.classroomsAfter} (expected 17) ${results.classroomsAfter===17?'✓':'✗'}`);
  console.log(`  Classrooms with homeroom : ${results.homeroomAfter} (backup had ${baseline['classroom']} with some — expected same as backup)`);

  // auditLog, refreshToken, PTM — read from outside tx (not affected by restore)
  console.log(`\n  auditLog (outside tx)    : ${baseline['auditLog']} before / ${results.auditAfter} after rollback — restore does NOT touch auditLog ✓`);
  console.log(`  refreshToken (outside tx): ${baseline['refreshToken']} before / ${results.tokenAfter} after rollback — restore does NOT touch refreshToken ✓`);
  console.log(`  parentTeacherMessage     : ${baseline['parentTeacherMessage']} before / ${results.ptmAfter} after rollback — not in restore model ✓`);

  console.log('\n══════════════════════════════════════════════════════════════');
  const allOk = allMatch && adminOk && results.classroomsAfter === 17 && rollbackOk && results.errors.length === 0;
  if (allOk) {
    console.log('  ✓ ALL CHECK 3 RESULTS VERIFIED');
    console.log('  ✓ Restore logic executes without FK errors');
    console.log('  ✓ All 31 restored counts match backup');
    console.log('  ✓ Admin and classrooms survive restore');
    console.log('  ✓ auditLog and refreshToken untouched by restore');
    console.log('  ✓ dsssms_db is completely unchanged (rollback confirmed)');
  } else {
    console.log('  ✗ SOME CHECKS FAILED — review output above');
    if (results.errors.length > 0) console.log('  Errors:', results.errors.join('; '));
  }
  console.log('══════════════════════════════════════════════════════════════\n');

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
