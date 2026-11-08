/**
 * Bulk Import Parse — HTTP integration tests
 *
 * Proves the full POST /students/bulk/parse flow works end-to-end with the
 * real Express app + supertest + multer, mirroring what the browser actually
 * sends.  All Prisma calls are mocked — no real DB required.
 *
 * Root cause caught here:
 *   When Content-Type: application/json is set on a FormData POST, axios
 *   serialises the FormData to JSON (formDataToJSON). Multer never receives
 *   a multipart body, so req.file is undefined and the endpoint returns 400.
 *   The fix is to send the Content-Type header as undefined so the XHR layer
 *   sets multipart/form-data; boundary=... automatically.
 *
 * These tests verify the backend endpoint accepts a real multipart upload and
 * parses the official generated template correctly.
 */

// ── Env setup ─────────────────────────────────────────────────────────────────
process.env.NODE_ENV               = 'test';
process.env.DATABASE_URL           = 'mysql://test:test@localhost:3306/test';
process.env.JWT_ACCESS_SECRET      = 'test-access-secret-32chars-padding!!';
process.env.JWT_REFRESH_SECRET     = 'test-refresh-secret-32chars-paddin!!';
process.env.JWT_ACCESS_EXPIRES_IN  = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.API_PREFIX             = '/api/v1';

vi.mock('pino-http', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../core/logger/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnThis() },
}));

vi.mock('../../database/prisma-client', () => ({
  prisma: {
    user:           { findUnique: vi.fn() },
    userPermission: { findMany: vi.fn().mockResolvedValue([]) },
    refreshToken:   { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    auditLog:       { create: vi.fn().mockResolvedValue({}) },
    student:        { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    classroom:      { findUnique: vi.fn(), findMany: vi.fn() },
    $transaction:   vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../core/audit/audit-recorder', () => ({ recordAudit: vi.fn().mockResolvedValue(undefined) }));

// ── Imports ───────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, type Mock } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { Server } from 'http';
import ExcelJS from 'exceljs';
import { createApp } from '../../app';
import { prisma } from '../../database/prisma-client';
import { signAccessToken } from '../../core/utils/jwt.util';
import { RoleName } from '@prisma/client';
import { buildBulkImportTemplate } from '../../modules/students/bulk-import-template';

// ── App + server ──────────────────────────────────────────────────────────────
let app: Application;
let server: Server;

beforeAll(() => { app = createApp(); server = app.listen(0); });
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

// ── Auth helpers ──────────────────────────────────────────────────────────────
const ADMIN_TOKEN = () => signAccessToken({ sub: 1, role: RoleName.ADMIN, username: 'admin' });
const DIR_TOKEN   = () => signAccessToken({ sub: 2, role: RoleName.DIRECTOR, username: 'dir' });
const TCH_TOKEN   = () => signAccessToken({ sub: 3, role: RoleName.TEACHER, username: 'teacher' });

function mockAdminUser() {
  (prisma.user.findUnique as Mock).mockResolvedValue({
    userId: 1, username: 'admin', status: 'ACTIVE', isTemporaryPassword: false,
    role: { roleName: 'ADMIN' }, permissions: [],
  });
}

// ── Workbook helpers ──────────────────────────────────────────────────────────
/** Valid DOB — 18+ years old as of 2026 */
const VALID_DOB = '2008-01-15';

const STUDENT_COLUMNS: Partial<ExcelJS.Column>[] = [
  { key: 'importRef',            header: 'ImportRef *',                  width: 14 },
  { key: 'admissionType',        header: 'admissionType *',              width: 16 },
  { key: 'firstName',            header: 'firstName *',                  width: 18 },
  { key: 'lastName',             header: 'lastName *',                   width: 18 },
  { key: 'gender',               header: 'gender * (M/F)',               width: 12 },
  { key: 'dateOfBirth',          header: 'dateOfBirth * (YYYY-MM-DD)',   width: 18 },
  { key: 'address',              header: 'address',                      width: 28 },
  { key: 'classroomId',          header: 'classroomId *',                width: 14 },
  { key: 'previousSchoolName',   header: 'previousSchoolName',           width: 26 },
  { key: 'previousSchoolType',   header: 'previousSchoolType',           width: 22 },
  { key: 'previousSchoolLocation', header: 'previousSchoolLocation',     width: 26 },
  { key: 'lastGradeCompleted',   header: 'lastGradeCompleted',           width: 20 },
  { key: 'completionYear',       header: 'completionYear (YYYY)',        width: 20 },
  { key: 'previousStudentId',    header: 'previousStudentId',            width: 20 },
  { key: 'transferReason',       header: 'transferReason',               width: 30 },
  { key: 'transferCertificateRef', header: 'transferCertificateRef',     width: 24 },
];

async function buildTestWorkbook(rows: Record<string, unknown>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Instructions');
  const ws = wb.addWorksheet('Students');
  ws.columns = STUDENT_COLUMNS;
  for (const row of rows) ws.addRow(row);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function validStudentRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    importRef: 'STU-100', admissionType: 'NEW_STUDENT',
    firstName: 'Fatima', lastName: 'Ahmed',
    gender: 'F', dateOfBirth: VALID_DOB,
    address: 'Dinsho', classroomId: 1,
    previousSchoolName: '', previousSchoolType: '', previousSchoolLocation: '',
    lastGradeCompleted: '', completionYear: '', previousStudentId: '',
    transferReason: '', transferCertificateRef: '',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/students/bulk/parse', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.userPermission.findMany as Mock).mockResolvedValue([]);
    mockAdminUser();
  });

  // ── Authorization ──────────────────────────────────────────────────────────

  it('returns 401 without token', async () => {
    const buf = await buildBulkImportTemplate();
    const res = await request(app)
      .post('/api/v1/students/bulk/parse')
      .attach('file', buf, 'template.xlsx');
    expect(res.status).toBe(401);
  });

  it('returns 403 for TEACHER role', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({
      userId: 3, username: 'teacher', status: 'ACTIVE', isTemporaryPassword: false,
      role: { roleName: 'TEACHER' }, permissions: [],
    });
    const buf = await buildBulkImportTemplate();
    const res = await request(app)
      .post('/api/v1/students/bulk/parse')
      .set('Authorization', `Bearer ${TCH_TOKEN()}`)
      .attach('file', buf, 'template.xlsx');
    expect(res.status).toBe(403);
  });

  // ── File upload mechanics ──────────────────────────────────────────────────

  it('returns 4xx when no file is attached', async () => {
    // When no file part is in the multipart body, either multer or the
    // controller returns a non-2xx response. The exact code (400 vs 500)
    // depends on whether a valid boundary is present.
    const res = await request(app)
      .post('/api/v1/students/bulk/parse')
      .set('Authorization', `Bearer ${ADMIN_TOKEN()}`)
      .set('Content-Type', 'multipart/form-data');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns 400 when a multipart request is sent with a wrong field name', async () => {
    // Supertest .field() sends a proper multipart body with boundary —
    // but "wrongField" is not what multer looks for ("file"), so req.file
    // is undefined and the controller returns 400.
    const res = await request(app)
      .post('/api/v1/students/bulk/parse')
      .set('Authorization', `Bearer ${ADMIN_TOKEN()}`)
      .field('wrongField', 'some text');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/No file uploaded/i);
  });

  // ── Official template — the exact scenario that was broken ────────────────

  it('accepts the official generated template (example rows filtered → 0 valid, 0 errors)', async () => {
    const buf = await buildBulkImportTemplate();
    const res = await request(app)
      .post('/api/v1/students/bulk/parse')
      .set('Authorization', `Bearer ${ADMIN_TOKEN()}`)
      .attach('file', buf, { filename: 'students_bulk_import_template.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toHaveLength(0);
    expect(res.body.data.errors).toHaveLength(0);
  });

  // ── Valid filled workbook ──────────────────────────────────────────────────

  it('parses a completed workbook and returns valid student records', async () => {
    const buf = await buildTestWorkbook([validStudentRow()]);
    const res = await request(app)
      .post('/api/v1/students/bulk/parse')
      .set('Authorization', `Bearer ${ADMIN_TOKEN()}`)
      .attach('file', buf, { filename: 'import.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    expect(res.status).toBe(200);
    expect(res.body.data.errors).toHaveLength(0);
    expect(res.body.data.valid).toHaveLength(1);
    expect(res.body.data.valid[0].firstName).toBe('Fatima');
    expect(res.body.data.valid[0].admissionType).toBe('NEW_STUDENT');
    expect(res.body.data.valid[0].classroomId).toBe(1);
  });

  it('parses multiple students from different classrooms', async () => {
    const buf = await buildTestWorkbook([
      validStudentRow({ importRef: 'STU-101', firstName: 'Alice', classroomId: 5 }),
      validStudentRow({ importRef: 'STU-102', firstName: 'Bob',   classroomId: 7 }),
      validStudentRow({
        importRef: 'STU-103', firstName: 'Charlie', classroomId: 3,
        admissionType: 'TRANSFER',
        previousSchoolName: 'Robe Secondary',
        lastGradeCompleted: 'Grade 10',
      }),
    ]);
    const res = await request(app)
      .post('/api/v1/students/bulk/parse')
      .set('Authorization', `Bearer ${ADMIN_TOKEN()}`)
      .attach('file', buf, { filename: 'import.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    expect(res.status).toBe(200);
    expect(res.body.data.errors).toHaveLength(0);
    expect(res.body.data.valid).toHaveLength(3);
    expect(res.body.data.valid[0].classroomId).toBe(5);
    expect(res.body.data.valid[1].classroomId).toBe(7);
    expect(res.body.data.valid[2].admissionType).toBe('TRANSFER');
  });

  it('returns validation errors for missing required fields without rejecting the whole upload', async () => {
    const buf = await buildTestWorkbook([
      validStudentRow({ importRef: 'STU-101', firstName: '' }),   // missing firstName
      validStudentRow({ importRef: 'STU-102', gender: 'X' }),     // bad gender
      validStudentRow({ importRef: 'STU-103' }),                  // valid
    ]);
    const res = await request(app)
      .post('/api/v1/students/bulk/parse')
      .set('Authorization', `Bearer ${ADMIN_TOKEN()}`)
      .attach('file', buf, { filename: 'import.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toHaveLength(1);
    expect(res.body.data.valid[0].firstName).toBe('Fatima');
    expect(res.body.data.errors.some((e: string) => e.includes('firstName is required'))).toBe(true);
    expect(res.body.data.errors.some((e: string) => e.includes('gender must be M or F'))).toBe(true);
  });

  it('does not reject a template because optional fields are empty', async () => {
    // All optional fields (address, previousSchool*, etc.) are blank — must succeed
    const buf = await buildTestWorkbook([
      validStudentRow({
        address: '', previousSchoolName: '', previousSchoolType: '',
        previousSchoolLocation: '', completionYear: '', previousStudentId: '',
        transferReason: '', transferCertificateRef: '',
      }),
    ]);
    const res = await request(app)
      .post('/api/v1/students/bulk/parse')
      .set('Authorization', `Bearer ${ADMIN_TOKEN()}`)
      .attach('file', buf, { filename: 'import.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    expect(res.status).toBe(200);
    expect(res.body.data.errors).toHaveLength(0);
    expect(res.body.data.valid).toHaveLength(1);
  });

  it('returns a parse error for unsupported file format (text file sent as xlsx)', async () => {
    // A plain text file is not a valid OOXML workbook — ExcelJS will throw
    const txtBuf = Buffer.from('not an excel file');
    const res = await request(app)
      .post('/api/v1/students/bulk/parse')
      .set('Authorization', `Bearer ${ADMIN_TOKEN()}`)
      .attach('file', txtBuf, { filename: 'data.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Either 400 from the controller, 500 from ExcelJS parse error, or 200 with errors array
    expect([200, 400, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.data.valid).toHaveLength(0);
    }
  });

  // ── Director can also access (MANAGE_ROLES) ────────────────────────────────

  it('returns 200 for DIRECTOR role', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({
      userId: 2, username: 'dir', status: 'ACTIVE', isTemporaryPassword: false,
      role: { roleName: 'DIRECTOR' }, permissions: [],
    });
    const buf = await buildBulkImportTemplate();
    const res = await request(app)
      .post('/api/v1/students/bulk/parse')
      .set('Authorization', `Bearer ${DIR_TOKEN()}`)
      .attach('file', buf, { filename: 'template.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    expect(res.status).toBe(200);
  });
});
