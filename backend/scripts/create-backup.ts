/**
 * create-backup.ts
 * Creates a complete database backup by calling the same BackupService
 * used by the HTTP API. Run before any destructive cleanup.
 * Usage: npx tsx scripts/create-backup.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const dbUrl = new URL(process.env.DATABASE_URL!);
const adapter = new PrismaMariaDb({
  host: dbUrl.hostname, port: Number(dbUrl.port || 3306),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.replace(/^\//, ''),
  connectionLimit: 5,
});
const prisma = new PrismaClient({ adapter });

const MODELS_IN_INSERT_ORDER = [
  'role', 'user', 'administrator', 'director', 'viceDirector', 'teacher',
  'subject', 'classroom', 'teacherSubject', 'student', 'parent',
  'studentParentLink', 'studentEnrollment', 'userPermission', 'attendance',
  'gradeComponent', 'gradeEntry', 'gradeSubjectConfig', 'subjectFinalization',
  'classroomFinalization', 'academicReport', 'studentConduct', 'disciplineRecord',
  'notification', 'timetableEntry', 'assignment', 'assignmentSubmission',
  'promotionBatch', 'promotionEntry', 'studentIdCounter', 'systemSetting',
] as const;

async function main(): Promise<void> {
  console.log('\n=== DSSSMS Pre-Cleanup Backup ===\n');

  const BACKUP_DIR = path.join(process.cwd(), 'backups');
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const data: Record<string, unknown[]> = {};
  let totalRows = 0;
  for (const model of MODELS_IN_INSERT_ORDER) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (prisma as any)[model].findMany();
    data[model] = rows;
    totalRows += rows.length;
    console.log(`  ${model.padEnd(25)}: ${rows.length} rows`);
  }

  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const fileName = `backup-${stamp}-pre-cleanup.json`;
  const filePath = path.join(BACKUP_DIR, fileName);

  const contents = { version: 1, createdAt: now.toISOString(), data };
  await fs.writeFile(filePath, JSON.stringify(contents), 'utf-8');
  const stat = await fs.stat(filePath);

  console.log(`\n✓ Backup written to: backups/${fileName}`);
  console.log(`  Total rows backed up : ${totalRows}`);
  console.log(`  File size            : ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`  Timestamp            : ${now.toISOString()}`);
  console.log('\nBackup complete. Verify the file exists before proceeding.\n');

  await prisma.$disconnect();
}

main().catch(e => { console.error('Backup failed:', e); process.exit(1); });
