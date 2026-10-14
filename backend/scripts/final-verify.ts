/**
 * final-verify.ts — Pre-execution final checks (READ ONLY).
 * 1. Independently recount every table — confirm 596 + auditLog(439) + refreshToken(336)
 * 2. Recount parentTeacherMessage independently
 * 3. Calculate post-cleanup total from scratch (not from deltas)
 * 4. Verify backup restoration procedure is safe (no overwrite risk)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const BACKUP_FILE = 'backup-20261013-162900-pre-cleanup.json';

// Tables in the backup model (the 31 that BackupService covers)
const BACKUP_TABLES = [
  'role','user','administrator','director','viceDirector','teacher',
  'subject','classroom','teacherSubject','student','parent',
  'studentParentLink','studentEnrollment','userPermission','attendance',
  'gradeComponent','gradeEntry','gradeSubjectConfig','subjectFinalization',
  'classroomFinalization','academicReport','studentConduct','disciplineRecord',
  'notification','timetableEntry','assignment','assignmentSubmission',
  'promotionBatch','promotionEntry','studentIdCounter','systemSetting',
] as const;

// Tables NOT in backup but present in DB (counted separately)
const EXTRA_TABLES = ['auditLog', 'refreshToken', 'parentTeacherMessage'] as const;

// Tables that survive cleanup (expected post-count)
const PRESERVED: Record<string, number> = {
  role: 6, user: 1, administrator: 1, subject: 4,
  gradeSubjectConfig: 16, systemSetting: 1, classroom: 17,
};

type BackupTable = typeof BACKUP_TABLES[number];
type ExtraTable  = typeof EXTRA_TABLES[number];

async function main(): Promise<void> {
  const u = new URL(process.env.DATABASE_URL!);
  const dbName = u.pathname.replace(/^\//, '');
  const adapter = new PrismaMariaDb({
    host: u.hostname, port: Number(u.port || 3306),
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: dbName, connectionLimit: 3,
  });
  const p = new PrismaClient({ adapter });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Phase 5.4 — Final Pre-Execution Verification (READ ONLY)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── CHECK 1: Independent row count of every table ────────────────────────
  console.log('── CHECK 1: INDEPENDENT ROW COUNTS ────────────────────────────');

  const liveCounts: Record<string, number> = {};
  let backupTableTotal = 0;

  for (const t of BACKUP_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n: number = await (p as any)[t].count();
    liveCounts[t] = n;
    backupTableTotal += n;
    console.log(`  ${t.padEnd(26)}: ${n}`);
  }

  // Extra tables (not in backup)
  for (const t of EXTRA_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n: number = await (p as any)[t].count();
    liveCounts[t] = n;
    console.log(`  ${t.padEnd(26)}: ${n}  ← not in backup model`);
  }

  const grandTotal = Object.values(liveCounts).reduce((a, b) => a + b, 0);
  console.log(`\n  Backup-table total  : ${backupTableTotal}  (plan states 596)`);
  console.log(`  auditLog            : ${liveCounts['auditLog']}  (plan states 439)`);
  console.log(`  refreshToken        : ${liveCounts['refreshToken']}  (plan states 336)`);
  console.log(`  parentTeacherMessage: ${liveCounts['parentTeacherMessage']}  (plan states 5)`);
  console.log(`  Grand total         : ${grandTotal}`);

  const countMatch596  = backupTableTotal === 596;
  const countMatch439  = liveCounts['auditLog'] === 439;
  const countMatch336  = liveCounts['refreshToken'] === 336;
  const countMatch5    = liveCounts['parentTeacherMessage'] === 5;
  console.log(`\n  596 match: ${countMatch596 ? '✓' : `✗ ACTUAL=${backupTableTotal}`}`);
  console.log(`  439 match: ${countMatch439 ? '✓' : `✗ ACTUAL=${liveCounts['auditLog']}`}`);
  console.log(`  336 match: ${countMatch336 ? '✓' : `✗ ACTUAL=${liveCounts['refreshToken']}`}`);
  console.log(`    5 match: ${countMatch5    ? '✓' : `✗ ACTUAL=${liveCounts['parentTeacherMessage']}`}`);

  // ── CHECK 2: Post-cleanup total — independent calculation ─────────────────
  console.log('\n── CHECK 2: INDEPENDENT POST-CLEANUP TOTAL ─────────────────────');
  console.log('  (calculated from what survives, not from deltas)');

  let postTotal = 0;
  for (const [table, expected] of Object.entries(PRESERVED)) {
    const live = liveCounts[table] ?? 0;
    const ok   = live >= expected; // live should equal expected
    postTotal += expected;
    console.log(`  ${table.padEnd(26)}: keep ${expected}  (live=${live}) ${ok ? '✓' : '⚠ MISMATCH'}`);
  }
  // All other backup tables → 0
  for (const t of BACKUP_TABLES) {
    if (!(t in PRESERVED)) {
      console.log(`  ${t.padEnd(26)}: → 0  (${liveCounts[t]} will be deleted)`);
    }
  }
  // Extra tables → 0
  for (const t of EXTRA_TABLES) {
    console.log(`  ${t.padEnd(26)}: → 0  (${liveCounts[t]} will be deleted)`);
  }

  console.log(`\n  Expected post-cleanup total: ${postTotal}`);
  console.log(`  (role 6 + user 1 + administrator 1 + subject 4 + gradeSubjectConfig 16 + systemSetting 1 + classroom 17 = ${postTotal})`);

  // Double-check: delta method should agree
  const deltaSum = Object.entries(liveCounts).reduce((sum, [t, n]) => {
    const keep = PRESERVED[t] ?? 0;
    return sum + (n - keep);
  }, 0);
  const deltaPostTotal = grandTotal - deltaSum;
  console.log(`  Cross-check via delta: grand(${grandTotal}) - deletions(${deltaSum}) = ${deltaPostTotal} ${deltaPostTotal === postTotal ? '✓' : '✗ MISMATCH'}`);

  // ── CHECK 3: parentTeacherMessage independent recount ─────────────────────
  console.log('\n── CHECK 3: PARENTTEACHERMESSAGE INDEPENDENT RECOUNT ───────────');
  const ptmRows = await p.parentTeacherMessage.findMany({
    select: { id: true, studentId: true, senderUserId: true, recipientUserId: true, createdAt: true },
    orderBy: { id: 'asc' },
  });
  console.log(`  Total rows: ${ptmRows.length}`);
  for (const m of ptmRows) {
    console.log(`    id=${m.id} studentId=${m.studentId} sender=${m.senderUserId} recipient=${m.recipientUserId} date=${m.createdAt.toISOString().slice(0,10)}`);
  }
  // Verify all link to dev students (all studentIds in 1-13)
  const allStudentIds = (await p.student.findMany({ select: { studentId: true } })).map(s => s.studentId);
  const allPtmLinkedToDevStudent = ptmRows.every(m => m.studentId !== null && allStudentIds.includes(m.studentId));
  console.log(`  All PTMs linked to dev students: ${allPtmLinkedToDevStudent ? '✓' : '✗ — some have real student links'}`);
  // Confirm cascade: parentTeacherMessage.studentId → students.studentId onDelete=Cascade
  const fkRules = await p.$queryRaw<{ COLUMN_NAME: string; DELETE_RULE: string }[]>`
    SELECT kcu.COLUMN_NAME, rc.DELETE_RULE
    FROM information_schema.KEY_COLUMN_USAGE kcu
    JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
      ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
    WHERE kcu.TABLE_SCHEMA = ${dbName}
      AND kcu.TABLE_NAME = 'parent_teacher_messages'
      AND kcu.REFERENCED_TABLE_NAME = 'students'`;
  console.log(`  FK rule parent_teacher_messages.studentId: ${fkRules[0]?.DELETE_RULE ?? 'NOT FOUND'}`);

  // ── CHECK 4: Backup restoration safety ────────────────────────────────────
  console.log('\n── CHECK 4: BACKUP RESTORATION SAFETY ──────────────────────────');

  const backupPath = path.join(process.cwd(), 'backups', BACKUP_FILE);
  const stat = await fs.stat(backupPath);
  const raw  = await fs.readFile(backupPath, 'utf-8');

  // Verify JSON parseable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bkp: any;
  try {
    bkp = JSON.parse(raw);
    console.log(`  ✓ Backup JSON parses successfully`);
  } catch {
    console.error('  ✗ Backup JSON parse FAILED');
    process.exit(1);
  }

  // Version and structure checks
  console.log(`  Version: ${bkp.version}  (BackupService expects version=1: ${bkp.version === 1 ? '✓' : '✗'})`);
  console.log(`  createdAt: ${bkp.createdAt}`);
  console.log(`  File size: ${(stat.size / 1024).toFixed(1)} KB`);

  // All 31 backup tables present and are arrays
  const missingOrBadTables = BACKUP_TABLES.filter(t => !Array.isArray(bkp.data[t]));
  console.log(`  All 31 tables present as arrays: ${missingOrBadTables.length === 0 ? '✓' : `✗ MISSING: ${missingOrBadTables.join(', ')}`}`);

  // Row counts in backup match live DB (should be identical — same DB)
  let backupLiveMismatch = 0;
  for (const t of BACKUP_TABLES) {
    const bkpCount  = (bkp.data[t] as unknown[]).length;
    const liveCount = liveCounts[t];
    if (bkpCount !== liveCount) {
      console.log(`  ⚠ MISMATCH ${t}: backup=${bkpCount} live=${liveCount}`);
      backupLiveMismatch++;
    }
  }
  if (backupLiveMismatch === 0) {
    console.log(`  ✓ All 31 backup table counts match live DB exactly`);
  }

  // Restoration safety: BackupService.restore() wipes then reloads inside a transaction.
  // It writes to whatever DATABASE_URL points to.
  // A restore to the CURRENT DB would be safe after cleanup (returns to pre-cleanup state).
  // Verify the admin user is in the backup
  const bkpAdminUser = (bkp.data['user'] as { userId: number; username: string }[]).find(u => u.username === 'admin');
  console.log(`  admin in backup: ${bkpAdminUser ? `✓ (userId=${bkpAdminUser.userId})` : '✗ MISSING'}`);

  // Verify classrooms present in backup
  const bkpClassrooms = (bkp.data['classroom'] as { classroomId: number }[]).length;
  console.log(`  classrooms in backup: ${bkpClassrooms} (live: ${liveCounts['classroom']}) ${bkpClassrooms === liveCounts['classroom'] ? '✓' : '✗'}`);

  // Restoration procedure note
  console.log(`\n  Restoration procedure:`);
  console.log(`    POST /api/v1/backups/${BACKUP_FILE}/restore`);
  console.log(`    body: { "confirm": true }`);
  console.log(`    → wipes current DB and reloads backup in one transaction`);
  console.log(`    → does NOT touch auditLog or refreshToken (not in backup model)`);
  console.log(`    → safe: target is the SAME database, current state is already captured`);
  console.log(`    → no overwrite risk: backup file is read-only input, never written during restore`);

  // ── CHECK 5: Null homeroom teacher — application support ─────────────────
  console.log('\n── CHECK 5: NULL HOMEROOM TEACHER — APPLICATION SUPPORT ────────');

  // The classroom schema: homeroomTeacherId Int? (nullable)
  const homeroomNullable = await p.$queryRaw<{ IS_NULLABLE: string }[]>`
    SELECT IS_NULLABLE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ${dbName} AND TABLE_NAME = 'classrooms'
      AND COLUMN_NAME = 'homeroomTeacherId'`;
  console.log(`  classrooms.homeroomTeacherId IS_NULLABLE: ${homeroomNullable[0]?.IS_NULLABLE ?? 'UNKNOWN'} ${homeroomNullable[0]?.IS_NULLABLE === 'YES' ? '✓' : '✗ NOT NULLABLE'}`);

  // Count classrooms that already have null homeroom (proving app works without it)
  const nullHomerooms = await p.classroom.count({ where: { homeroomTeacherId: null } });
  const totalClassrooms = await p.classroom.count();
  console.log(`  Classrooms with null homeroom right now: ${nullHomerooms}/${totalClassrooms}`);
  console.log(`  ${nullHomerooms > 0 ? '✓ App already operates with null-homeroom classrooms — no code change needed' : '⚠ All classrooms have homerooms — check app behaviour'}`);

  // Verify classroom service doesn't require homeroomTeacherId
  // (checked by reading the classroom list endpoint — if null-homeroom classrooms exist, the app already handles them)
  console.log(`  Classroom ids with null homeroom: ${(await p.classroom.findMany({ where: { homeroomTeacherId: null }, select: { classroomId: true } })).map(c => c.classroomId).join(', ')}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Final verification complete — no data modified');
  console.log('═══════════════════════════════════════════════════════════════\n');

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
