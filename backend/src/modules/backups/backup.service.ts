import fs from 'fs/promises';
import path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { recordAudit } from '../../core/audit/audit-recorder';
import { BadRequestError, NotFoundError } from '../../core/errors/app-error';
import { BackupFileContents, BackupFileDto } from './dto/backup.dto';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const BACKUP_FORMAT_VERSION = 1;
const FILE_NAME_PATTERN = /^backup-\d{8}-\d{6}\.json$/;

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Every table that makes up "the school's data", listed so that inserting
 * top-to-bottom never hits a foreign key that hasn't been created yet.
 * Deletion for a restore walks this list in reverse. Session/security
 * tables (`refreshToken`) and the audit trail itself (`auditLog`) are
 * intentionally excluded — they're not "school data" and restoring old
 * sessions would be actively wrong.
 */
const MODELS_IN_INSERT_ORDER = [
  'role',
  'user',
  'administrator',
  'director',
  'viceDirector',
  'teacher',
  'subject',
  'classroom',
  'teacherSubject',
  'student',
  'parent',
  'studentParentLink',
  'attendance',
  'gradeComponent',
  'gradeEntry',
  'academicReport',
  'notification',
  'timetableEntry',
  'assignment',
  'assignmentSubmission',
  'systemSetting',
] as const;

type ModelName = (typeof MODELS_IN_INSERT_ORDER)[number];

function delegateFor(client: DbClient, model: ModelName) {
  return client[model] as unknown as {
    findMany: () => Promise<Record<string, unknown>[]>;
    deleteMany: () => Promise<unknown>;
    createMany: (args: { data: Record<string, unknown>[] }) => Promise<unknown>;
  };
}

/** Turns any ISO-8601-looking string back into a real Date, recursively. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
function reviveDates(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) return new Date(value);
  return value;
}

async function ensureBackupDir(): Promise<void> {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

function buildFileName(now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  return `backup-${stamp}.json`;
}

function assertSafeFileName(fileName: string): void {
  if (!FILE_NAME_PATTERN.test(fileName)) {
    throw new BadRequestError('Invalid backup file name');
  }
}

export class BackupService {
  async list(): Promise<BackupFileDto[]> {
    await ensureBackupDir();
    const entries = await fs.readdir(BACKUP_DIR);
    const files = await Promise.all(
      entries
        .filter((name) => FILE_NAME_PATTERN.test(name))
        .map(async (fileName) => {
          const stat = await fs.stat(path.join(BACKUP_DIR, fileName));
          return { fileName, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
        })
    );

    return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(actor: { userId: number; ipAddress?: string }): Promise<BackupFileDto> {
    await ensureBackupDir();

    const data: Record<string, Record<string, unknown>[]> = {};
    for (const model of MODELS_IN_INSERT_ORDER) {
      data[model] = await delegateFor(prisma, model).findMany();
    }

    const now = new Date();
    const contents: BackupFileContents = { version: BACKUP_FORMAT_VERSION, createdAt: now.toISOString(), data };
    const fileName = buildFileName(now);
    const filePath = path.join(BACKUP_DIR, fileName);

    await fs.writeFile(filePath, JSON.stringify(contents), 'utf-8');
    const stat = await fs.stat(filePath);

    await recordAudit({
      userId: actor.userId,
      action: 'BACKUP_CREATED',
      entity: 'Backup',
      entityId: fileName,
      ipAddress: actor.ipAddress,
      metadata: { sizeBytes: stat.size, tableCounts: Object.fromEntries(MODELS_IN_INSERT_ORDER.map((m) => [m, data[m].length])) },
    });

    return { fileName, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
  }

  /** Resolves a backup file name to its on-disk path, after validating the name is well-formed and the file exists. */
  async resolvePath(fileName: string): Promise<string> {
    assertSafeFileName(fileName);
    const filePath = path.join(BACKUP_DIR, fileName);
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundError('Backup file not found');
    }
    return filePath;
  }

  /** Persists an uploaded backup file to disk after validating its shape, so it can be reviewed and restored separately. */
  async saveUploaded(buffer: Buffer, actor: { userId: number; ipAddress?: string }): Promise<BackupFileDto> {
    await ensureBackupDir();

    let contents: BackupFileContents;
    try {
      contents = JSON.parse(buffer.toString('utf-8'), reviveDates) as BackupFileContents;
    } catch {
      throw new BadRequestError('Uploaded file is not valid JSON');
    }

    if (contents.version !== BACKUP_FORMAT_VERSION || typeof contents.data !== 'object' || contents.data === null) {
      throw new BadRequestError('Uploaded file is not a recognized DSSSMS backup');
    }
    for (const model of MODELS_IN_INSERT_ORDER) {
      if (!Array.isArray(contents.data[model])) {
        throw new BadRequestError(`Uploaded backup is missing table "${model}"`);
      }
    }

    const now = new Date();
    const fileName = buildFileName(now);
    await fs.writeFile(path.join(BACKUP_DIR, fileName), JSON.stringify(contents), 'utf-8');
    const stat = await fs.stat(path.join(BACKUP_DIR, fileName));

    await recordAudit({
      userId: actor.userId,
      action: 'BACKUP_UPLOADED',
      entity: 'Backup',
      entityId: fileName,
      ipAddress: actor.ipAddress,
    });

    return { fileName, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
  }

  async delete(fileName: string, actor: { userId: number; ipAddress?: string }): Promise<void> {
    const filePath = await this.resolvePath(fileName);
    await fs.unlink(filePath);

    await recordAudit({
      userId: actor.userId,
      action: 'BACKUP_DELETED',
      entity: 'Backup',
      entityId: fileName,
      ipAddress: actor.ipAddress,
    });
  }

  /**
   * Wipes every table listed in `MODELS_IN_INSERT_ORDER` and reloads it
   * from the backup file, inside a single transaction — either the whole
   * database moves to the backup's state, or (on any error) none of it
   * does. This is maximally destructive and admin-only; the controller
   * requires an explicit `confirm: true` before calling this.
   */
  async restore(fileName: string, actor: { userId: number; ipAddress?: string }): Promise<{ tableCounts: Record<string, number> }> {
    const filePath = await this.resolvePath(fileName);
    const raw = await fs.readFile(filePath, 'utf-8');

    let contents: BackupFileContents;
    try {
      contents = JSON.parse(raw, reviveDates) as BackupFileContents;
    } catch {
      throw new BadRequestError('Backup file is not valid JSON');
    }

    if (contents.version !== BACKUP_FORMAT_VERSION || typeof contents.data !== 'object' || contents.data === null) {
      throw new BadRequestError('Backup file is not a recognized DSSSMS backup');
    }
    for (const model of MODELS_IN_INSERT_ORDER) {
      if (!Array.isArray(contents.data[model])) {
        throw new BadRequestError(`Backup file is missing table "${model}"`);
      }
    }

    const tableCounts: Record<string, number> = {};

    await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        for (const model of [...MODELS_IN_INSERT_ORDER].reverse()) {
          await delegateFor(tx, model).deleteMany();
        }
        for (const model of MODELS_IN_INSERT_ORDER) {
          const rows = contents.data[model];
          tableCounts[model] = rows.length;
          if (rows.length > 0) {
            await delegateFor(tx, model).createMany({ data: rows });
          }
        }
      },
      { timeout: 120_000 }
    );

    await recordAudit({
      userId: actor.userId,
      action: 'BACKUP_RESTORED',
      entity: 'Backup',
      entityId: fileName,
      ipAddress: actor.ipAddress,
      metadata: { tableCounts },
    });

    return { tableCounts };
  }
}

export const backupService = new BackupService();
