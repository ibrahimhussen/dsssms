/**
 * Unit tests for the server-side bulk import workbook parser.
 *
 * Tests cover:
 *  - Valid workbook with students, guardians, and previous academic data
 *  - Example row filtering (STU-001, STU-002)
 *  - Missing required fields and invalid values
 *  - TRANSFER-specific required fields
 *  - Guardian validation
 *  - Previous academic assembly
 *  - Round-trip with the actual template generator
 */
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseBulkImportWorkbook } from '../bulk-import-parser';
import { buildBulkImportTemplate } from '../bulk-import-template';

// ── Test data helpers ─────────────────────────────────────────────────────────
//
// ExcelJS addRow() matches data by the column `key`, not the header text.
// The helpers below use column keys so data lands in the correct cells.
// The header row is set from the `header` property in ws.columns, which the
// parser reads to determine column names.

/** Valid DOB — 18+ years old as of 2026 (MINIMUM_ADMISSION_AGE = 16) */
const VALID_DOB = '2008-01-15';
/** Underage DOB — ~14 years old as of 2026 */
const UNDERAGE_DOB = '2012-06-01';

function validStudentRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    importRef: 'STU-100',
    admissionType: 'NEW_STUDENT',
    firstName: 'Test',
    lastName: 'Student',
    gender: 'M',
    dateOfBirth: VALID_DOB,
    address: '123 Test Street',
    classroomId: 1,
    previousSchoolName: '',
    previousSchoolType: '',
    previousSchoolLocation: '',
    lastGradeCompleted: '',
    completionYear: '',
    previousStudentId: '',
    transferReason: '',
    transferCertificateRef: '',
    ...overrides,
  };
}

function validGuardianRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    importRef: 'STU-100',
    guardianFullName: 'Jane Doe',
    guardianPhoneNumber: '+251911000000',
    relationship: 'MOTHER',
    guardianEmail: '',
    ...overrides,
  };
}

function validPrevAcademicRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    importRef: 'STU-100',
    subjectName: 'Mathematics',
    mark: 85,
    grade: 'A',
    overallAverage: '',
    notes: '',
    ...overrides,
  };
}

// ── Workbook builder ─────────────────────────────────────────────────────────

const STUDENT_COLUMNS: Partial<ExcelJS.Column>[] = [
  { key: 'importRef', header: 'ImportRef *', width: 14 },
  { key: 'admissionType', header: 'admissionType *', width: 16 },
  { key: 'firstName', header: 'firstName *', width: 18 },
  { key: 'lastName', header: 'lastName *', width: 18 },
  { key: 'gender', header: 'gender * (M/F)', width: 12 },
  { key: 'dateOfBirth', header: 'dateOfBirth * (YYYY-MM-DD)', width: 18 },
  { key: 'address', header: 'address', width: 28 },
  { key: 'classroomId', header: 'classroomId *', width: 14 },
  { key: 'previousSchoolName', header: 'previousSchoolName', width: 26 },
  { key: 'previousSchoolType', header: 'previousSchoolType', width: 22 },
  { key: 'previousSchoolLocation', header: 'previousSchoolLocation', width: 26 },
  { key: 'lastGradeCompleted', header: 'lastGradeCompleted', width: 20 },
  { key: 'completionYear', header: 'completionYear (YYYY)', width: 20 },
  { key: 'previousStudentId', header: 'previousStudentId', width: 20 },
  { key: 'transferReason', header: 'transferReason', width: 30 },
  { key: 'transferCertificateRef', header: 'transferCertificateRef', width: 24 },
];

const GUARDIAN_COLUMNS: Partial<ExcelJS.Column>[] = [
  { key: 'importRef', header: 'ImportRef * (from Students sheet)', width: 22 },
  { key: 'guardianFullName', header: 'guardianFullName *', width: 28 },
  { key: 'guardianPhoneNumber', header: 'guardianPhoneNumber', width: 20 },
  { key: 'relationship', header: 'relationship *', width: 20 },
  { key: 'guardianEmail', header: 'guardianEmail (optional)', width: 26 },
];

const PREV_ACADEMIC_COLUMNS: Partial<ExcelJS.Column>[] = [
  { key: 'importRef', header: 'ImportRef * (from Students sheet)', width: 22 },
  { key: 'subjectName', header: 'subjectName *', width: 24 },
  { key: 'mark', header: 'mark (0–100)', width: 14 },
  { key: 'grade', header: 'grade (e.g. A, B, C)', width: 18 },
  { key: 'overallAverage', header: 'overallAverage (leave blank if using per-subject marks)', width: 38 },
  { key: 'notes', header: 'notes', width: 30 },
];

/** Builds an in-memory Excel workbook and returns its Buffer. */
async function buildWorkbook(opts: {
  students?: Record<string, unknown>[];
  guardians?: Record<string, unknown>[];
  prevAcademic?: Record<string, unknown>[];
  includeStudentsSheet?: boolean;
  includeInstructions?: boolean;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  if (opts.includeInstructions !== false) {
    wb.addWorksheet('Instructions');
  }

  if (opts.includeStudentsSheet !== false) {
    const ws = wb.addWorksheet('Students');
    ws.columns = STUDENT_COLUMNS;
    for (const row of opts.students ?? []) {
      ws.addRow(row);
    }
  }

  if (opts.guardians && opts.guardians.length > 0) {
    const ws = wb.addWorksheet('Guardians');
    ws.columns = GUARDIAN_COLUMNS;
    for (const row of opts.guardians) {
      ws.addRow(row);
    }
  }

  if (opts.prevAcademic && opts.prevAcademic.length > 0) {
    const ws = wb.addWorksheet('PrevAcademic');
    ws.columns = PREV_ACADEMIC_COLUMNS;
    for (const row of opts.prevAcademic) {
      ws.addRow(row);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('parseBulkImportWorkbook', () => {

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('parses a valid workbook with students, guardians, and prev academic', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow()],
      guardians: [validGuardianRow()],
      prevAcademic: [
        validPrevAcademicRow({ subjectName: 'Mathematics', mark: 85 }),
        validPrevAcademicRow({ subjectName: 'English', mark: 78, grade: 'B' }),
      ],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(1);

    const student = valid[0]!;
    expect(student.firstName).toBe('Test');
    expect(student.lastName).toBe('Student');
    expect(student.gender).toBe('M');
    expect(student.classroomId).toBe(1);
    expect(student.admissionType).toBe('NEW_STUDENT');
    expect(student.address).toBe('123 Test Street');

    // Guardians
    expect(student.parents).toHaveLength(1);
    const parent = student.parents![0]!;
    expect(parent.newParent?.fullName).toBe('Jane Doe');
    expect(parent.newParent?.phoneNumber).toBe('+251911000000');
    expect(parent.relationship).toBe('MOTHER');

    // Previous academic
    expect(student.previousAcademicSummary).toBeDefined();
    expect(student.previousAcademicSummary.subjects).toHaveLength(2);
    expect(student.previousAcademicSummary.subjects[0]!.subjectName).toBe('Mathematics');
    expect(student.previousAcademicSummary.subjects[0]!.mark).toBe(85);
  });

  it('parses a TRANSFER student with all transfer fields', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow({
        importRef: 'STU-200',
        admissionType: 'TRANSFER',
        previousSchoolName: 'Robe Secondary School',
        lastGradeCompleted: 'Grade 10',
        previousSchoolType: 'Secondary',
        previousSchoolLocation: 'Robe',
        completionYear: '2024',
        previousStudentId: 'ROBE-2022-0042',
        transferReason: 'Family relocation',
        transferCertificateRef: 'TC-2024-0088',
      })],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(1);
    expect(valid[0]!.admissionType).toBe('TRANSFER');
    expect(valid[0]!.previousSchoolName).toBe('Robe Secondary School');
    expect(valid[0]!.lastGradeCompleted).toBe('Grade 10');
    expect(valid[0]!.transferReason).toBe('Family relocation');
    expect(valid[0]!.transferCertificateRef).toBe('TC-2024-0088');
  });

  // ── Example row filtering ──────────────────────────────────────────────────

  it('filters out example rows (STU-001, STU-002)', async () => {
    const buf = await buildWorkbook({
      students: [
        validStudentRow({ importRef: 'STU-001' }),
        validStudentRow({ importRef: 'STU-002' }),
        validStudentRow({ importRef: 'STU-100' }),
      ],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(1);
    expect(valid[0]!.firstName).toBe('Test');
  });

  // ── Missing Students sheet ─────────────────────────────────────────────────

  it('returns error when Students sheet is missing', async () => {
    const buf = await buildWorkbook({
      includeStudentsSheet: false,
      guardians: [validGuardianRow()],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('missing the "Students" worksheet');
  });

  // ── Required field validation ──────────────────────────────────────────────

  it('rejects missing firstName', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow({ firstName: '' })],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.includes('firstName is required'))).toBe(true);
  });

  it('rejects missing lastName', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow({ lastName: '' })],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.includes('lastName is required'))).toBe(true);
  });

  it('rejects invalid gender', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow({ gender: 'X' })],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.includes('gender must be M or F'))).toBe(true);
  });

  it('rejects missing dateOfBirth', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow({ dateOfBirth: '' })],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.includes('dateOfBirth is required'))).toBe(true);
  });

  it('rejects invalid dateOfBirth', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow({ dateOfBirth: 'not-a-date' })],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.includes('dateOfBirth') && e.includes('not valid'))).toBe(true);
  });

  it('rejects future dateOfBirth', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow({ dateOfBirth: '2050-01-01' })],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.includes('cannot be in the future'))).toBe(true);
  });

  it('rejects underage student', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow({ dateOfBirth: UNDERAGE_DOB })],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.includes('at least') && e.includes('years old'))).toBe(true);
  });

  it('rejects invalid classroomId', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow({ classroomId: 'not-a-number' })],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.includes('classroomId') && e.includes('positive number'))).toBe(true);
  });

  it('rejects invalid admissionType', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow({ admissionType: 'GRADUATE' })],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.includes('admissionType must be NEW_STUDENT or TRANSFER'))).toBe(true);
  });

  // ── TRANSFER-specific validation ────────────────────────────────────────────

  it('requires previousSchoolName for TRANSFER', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow({
        admissionType: 'TRANSFER',
        lastGradeCompleted: 'Grade 10',
        previousSchoolName: '',
      })],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.includes('previousSchoolName is required for TRANSFER'))).toBe(true);
  });

  it('requires lastGradeCompleted for TRANSFER', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow({
        admissionType: 'TRANSFER',
        previousSchoolName: 'Robe Secondary',
        lastGradeCompleted: '',
      })],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.includes('lastGradeCompleted is required for TRANSFER'))).toBe(true);
  });

  // ── Duplicate ImportRef ────────────────────────────────────────────────────

  it('rejects duplicate ImportRef', async () => {
    const buf = await buildWorkbook({
      students: [
        validStudentRow({ importRef: 'STU-100' }),
        validStudentRow({ importRef: 'STU-100', firstName: 'Second' }),
      ],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(1); // first one is valid
    expect(errors.some((e) => e.includes('Duplicate ImportRef'))).toBe(true);
  });

  // ── Guardian validation ─────────────────────────────────────────────────────

  it('rejects guardian with missing name', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow()],
      guardians: [validGuardianRow({ guardianFullName: '' })],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.includes('guardianFullName is required'))).toBe(true);
  });

  it('rejects guardian with invalid relationship', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow()],
      guardians: [validGuardianRow({ relationship: 'UNCLE' })],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.includes('relationship') && e.includes('invalid'))).toBe(true);
  });

  it('accepts multiple guardians for one student', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow()],
      guardians: [
        validGuardianRow({ guardianFullName: 'Father Doe', relationship: 'FATHER' }),
        validGuardianRow({ guardianFullName: 'Mother Doe', relationship: 'MOTHER' }),
      ],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(1);
    expect(valid[0]!.parents).toHaveLength(2);
  });

  // ── Previous academic assembly ─────────────────────────────────────────────

  it('assembles previousAcademicSummary with overallAverage', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow()],
      prevAcademic: [
        validPrevAcademicRow({ overallAverage: 82, notes: 'Grade 8 final results' }),
      ],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(1);
    expect(valid[0]!.previousAcademicSummary).toBeDefined();
    expect(valid[0]!.previousAcademicSummary.overallAverage).toBe(82);
    expect(valid[0]!.previousAcademicSummary.notes).toBe('Grade 8 final results');
  });

  it('handles student without guardians or prev academic', async () => {
    const buf = await buildWorkbook({
      students: [validStudentRow()],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(1);
    expect(valid[0]!.parents).toBeUndefined();
    expect(valid[0]!.previousAcademicSummary).toBeUndefined();
  });

  // ── Multiple students ──────────────────────────────────────────────────────

  it('parses multiple students with mixed admission types', async () => {
    const buf = await buildWorkbook({
      students: [
        validStudentRow({ importRef: 'STU-101', firstName: 'Alice' }),
        validStudentRow({
          importRef: 'STU-102',
          firstName: 'Bob',
          admissionType: 'TRANSFER',
          previousSchoolName: 'Other School',
          lastGradeCompleted: 'Grade 10',
        }),
      ],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(2);
    expect(valid[0]!.firstName).toBe('Alice');
    expect(valid[0]!.admissionType).toBe('NEW_STUDENT');
    expect(valid[1]!.firstName).toBe('Bob');
    expect(valid[1]!.admissionType).toBe('TRANSFER');
  });

  it('collects errors from multiple rows without stopping', async () => {
    const buf = await buildWorkbook({
      students: [
        validStudentRow({ importRef: 'STU-101', firstName: '' }),
        validStudentRow({ importRef: 'STU-102', gender: 'X' }),
        validStudentRow({ importRef: 'STU-103' }), // valid
      ],
    });

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    expect(valid).toHaveLength(1);
    expect(valid[0]!.firstName).toBe('Test');
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.some((e) => e.includes('firstName is required'))).toBe(true);
    expect(errors.some((e) => e.includes('gender must be M or F'))).toBe(true);
  });

  // ── Template round-trip ─────────────────────────────────────────────────────

  it('parses the actual generated template (only example rows → 0 valid, 0 errors)', async () => {
    const buf = await buildBulkImportTemplate();

    const { valid, errors } = await parseBulkImportWorkbook(buf);

    // Template only contains example rows (STU-001, STU-002) which are filtered out
    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});
