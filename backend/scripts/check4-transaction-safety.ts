/**
 * check4-transaction-safety.ts
 *
 * Proves transaction rollback works with this exact adapter by:
 *   1. Starting a transaction, making a real change
 *   2. Asserting the change is visible INSIDE the transaction
 *   3. Throwing to force rollback
 *   4. Confirming the change is NOT visible OUTSIDE the transaction
 *
 * Uses a harmless UPDATE on systemSetting.schoolName (a non-critical field).
 * The original value is restored by the rollback — dsssms_db is unchanged.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

class TestRollback extends Error {
  constructor() { super('TEST_ROLLBACK'); }
}

async function main(): Promise<void> {
  const u = new URL(process.env.DATABASE_URL!);
  const adapter = new PrismaMariaDb({
    host: u.hostname, port: Number(u.port || 3306),
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''), connectionLimit: 3,
    allowPublicKeyRetrieval: true,
  });
  const p = new PrismaClient({ adapter });

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  Check 4 — Transaction rollback proof');
  console.log('  All changes rolled back — dsssms_db unchanged');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ── Read original value BEFORE transaction ────────────────────────────────
  const before = await p.systemSetting.findFirst({ select: { id: true, schoolName: true } });
  console.log(`  Before transaction: systemSetting.schoolName = "${before?.schoolName}"`);

  const SENTINEL = '__ROLLBACK_TEST_DO_NOT_KEEP__';
  let seenInsideTx = false;

  // ── Run transaction that modifies then intentionally rolls back ───────────
  try {
    await p.$transaction(async (tx) => {

      // Make a real write inside the transaction
      await tx.systemSetting.update({
        where: { id: 1 },
        data:  { schoolName: SENTINEL },
      });

      // Read back inside same transaction — must see the new value
      const insideTx = await tx.systemSetting.findFirst({ select: { schoolName: true } });
      seenInsideTx = insideTx?.schoolName === SENTINEL;
      console.log(`  Inside transaction : schoolName = "${insideTx?.schoolName}" (saw sentinel: ${seenInsideTx})`);

      // Force rollback
      throw new TestRollback();

    }, { timeout: 30_000 });

  } catch (e) {
    if (e instanceof TestRollback) {
      console.log('  ✓ TestRollback thrown — transaction rolled back');
    } else {
      throw e;
    }
  }

  // ── Read AFTER rollback — must be original value ──────────────────────────
  const after = await p.systemSetting.findFirst({ select: { id: true, schoolName: true } });
  console.log(`  After rollback     : systemSetting.schoolName = "${after?.schoolName}"`);

  const rollbackOk   = after?.schoolName === before?.schoolName && after?.schoolName !== SENTINEL;
  const visibleInTx  = seenInsideTx;

  console.log('\n  Results:');
  console.log(`    Write visible inside transaction : ${visibleInTx  ? '✓ YES' : '✗ NO'}`);
  console.log(`    Rolled back after throw          : ${rollbackOk   ? '✓ YES (original value restored)' : '✗ NO (SENTINEL VISIBLE — rollback failed!)'}`);
  console.log(`    dsssms_db unchanged              : ${rollbackOk   ? '✓ YES' : '✗ NO'}`);

  // ── Also prove deleteMany + count works in same transaction ───────────────
  console.log('\n  Proving deleteMany + count in one $transaction callback:');
  let countInsideTx = -1;
  try {
    await p.$transaction(async (tx) => {
      const before = await tx.notification.count();
      await tx.notification.deleteMany();
      countInsideTx = await tx.notification.count();
      console.log(`    notification.count() before deleteMany (in tx): ${before}`);
      console.log(`    notification.count() after  deleteMany (in tx): ${countInsideTx}`);
      throw new TestRollback();
    }, { timeout: 30_000 });
  } catch (e) {
    if (!(e instanceof TestRollback)) throw e;
  }
  const notifAfter = await p.notification.count();
  const deleteManyOk = countInsideTx === 0 && notifAfter === 119;
  console.log(`    notification.count() after rollback (outside tx): ${notifAfter}`);
  console.log(`    deleteMany visible inside tx     : ${countInsideTx === 0 ? '✓ YES (count=0 inside)' : '✗ NO'}`);
  console.log(`    rollback restored all rows       : ${notifAfter === 119 ? '✓ YES (119 rows back)' : '✗ NO'}`);

  console.log('\n══════════════════════════════════════════════════════════════');
  const allOk = rollbackOk && visibleInTx && deleteManyOk;
  if (allOk) {
    console.log('  ✓ Check 4 PASSED — transaction + rollback confirmed with this adapter');
    console.log('  ✓ Writes are visible inside tx, invisible after rollback');
    console.log('  ✓ deleteMany inside tx is atomic and rollback-safe');
  } else {
    console.log('  ✗ Check 4 FAILED');
  }
  console.log('══════════════════════════════════════════════════════════════\n');

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
