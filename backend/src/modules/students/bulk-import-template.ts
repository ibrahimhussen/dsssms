/**
 * Generates the complete multi-sheet Excel workbook for bulk student admission.
 *
 * Sheets:
 *  1. Instructions    — how to fill the workbook
 *  2. Students        — one row per student (core + previous school + transfer)
 *  3. Guardians       — one row per guardian (ImportRef links to Students sheet)
 *  4. PrevAcademic    — one row per subject per student (previous academic summary)
 */
import ExcelJS from 'exceljs';

function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { wrapText: true, vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };
  });
  row.height = 28;
}

function applyExampleStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
    cell.font = { italic: true, color: { argb: 'FF1565C0' } };
  });
}

function col(key: string, header: string, width: number): Partial<ExcelJS.Column> {
  return { key, header, width };
}

// ── Sheet 1: Instructions ─────────────────────────────────────────────────────

function addInstructionsSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet('Instructions');
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 80;

  const title = ws.getRow(1);
  title.getCell(1).value = 'DSSSMS Bulk Student Admission Template';
  title.getCell(1).font = { bold: true, size: 14 };
  ws.mergeCells('A1:B1');

  const rows = [
    [''],
    ['OVERVIEW', ''],
    ['Purpose', 'Admit multiple students in one operation using the same rules as individual admission.'],
    ['Supported types', 'New Grade 9 students (admissionType = NEW_STUDENT) and Transfer students (admissionType = TRANSFER).'],
    [''],
    ['HOW TO FILL', ''],
    ['Step 1', 'Fill the STUDENTS sheet — one row per student. The ImportRef column (e.g. STU-001) is your key to link data across sheets.'],
    ['Step 2', 'Fill the GUARDIANS sheet — one row per guardian. Use the same ImportRef as the student row.'],
    ['Step 3', 'Fill the PREV_ACADEMIC sheet — one row per subject result. Use the same ImportRef.'],
    ['Step 4', 'Upload this workbook in Student Management → Bulk Import.'],
    [''],
    ['IMPORTANT RULES', ''],
    ['ImportRef', 'Required. You choose the value (e.g. STU-001). It must be unique per student in this file. It is NOT the permanent student ID — the system generates DSH-YYYY-NNNNN IDs automatically.'],
    ['admissionType', 'NEW_STUDENT  or  TRANSFER  (exact value required)'],
    ['gender', 'M  or  F  (exact value required)'],
    ['dateOfBirth', 'YYYY-MM-DD format (e.g. 2008-03-15)'],
    ['classroomId', 'The numeric ID of the classroom shown in the Classrooms management page.'],
    ['Transfer students', 'previousSchoolName and lastGradeCompleted are required for TRANSFER admissions.'],
    ['Minimum age', 'Students must be at least 16 years old at admission.'],
    ['Example rows', 'Blue rows in each sheet are examples. Delete them before uploading.'],
    [''],
    ['FIELD LEGEND', ''],
    ['Required (NEW_STUDENT)', 'ImportRef, admissionType, firstName, lastName, gender, dateOfBirth, classroomId'],
    ['Required (TRANSFER)', 'All of the above, plus: previousSchoolName, lastGradeCompleted'],
    ['Optional', 'All other fields'],
  ];

  let r = 2;
  for (const [a, b] of rows) {
    const row = ws.getRow(r);
    row.getCell(1).value = a;
    row.getCell(2).value = b ?? '';
    if (a && !b && a !== '') {
      row.getCell(1).font = { bold: true, color: { argb: 'FF1B5E20' } };
    }
    r++;
  }
}

// ── Sheet 2: Students ─────────────────────────────────────────────────────────

function addStudentsSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet('Students');

  ws.columns = [
    col('importRef',            'ImportRef *',                      14),
    col('admissionType',        'admissionType *',                  16),
    col('firstName',            'firstName *',                      18),
    col('lastName',             'lastName *',                       18),
    col('gender',               'gender * (M/F)',                   12),
    col('dateOfBirth',          'dateOfBirth * (YYYY-MM-DD)',        18),
    col('address',              'address',                          28),
    col('classroomId',          'classroomId *',                    14),
    // Previous school
    col('previousSchoolName',   'previousSchoolName',               26),
    col('previousSchoolType',   'previousSchoolType',               22),
    col('previousSchoolLocation','previousSchoolLocation',          26),
    col('lastGradeCompleted',   'lastGradeCompleted',               20),
    col('completionYear',       'completionYear (YYYY)',            20),
    col('previousStudentId',    'previousStudentId',                20),
    // Transfer fields
    col('transferReason',       'transferReason',                   30),
    col('transferCertificateRef','transferCertificateRef',          24),
  ];

  applyHeaderStyle(ws.getRow(1));
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // Dropdown validation for admissionType
  ws.getColumn('admissionType').eachCell({ includeEmpty: false }, (cell, rowNum) => {
    if (rowNum === 1) return;
    cell.dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"NEW_STUDENT,TRANSFER"'],
      showErrorMessage: true,
      errorTitle: 'Invalid value',
      error: 'Must be NEW_STUDENT or TRANSFER',
    };
  });

  // Dropdown for gender on rows 2-502
  for (let i = 2; i <= 502; i++) {
    ws.getCell(`E${i}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"M,F"'],
      showErrorMessage: true,
      errorTitle: 'Invalid gender',
      error: 'Must be M or F',
    };
  }

  // Add two example rows (blue)
  const exRows = [
    {
      importRef: 'STU-001', admissionType: 'NEW_STUDENT',
      firstName: 'Fatima', lastName: 'Ahmed', gender: 'F',
      dateOfBirth: '2008-03-15', address: 'Dinsho Town', classroomId: 1,
      previousSchoolName: 'Dinsho Primary', previousSchoolType: 'Primary',
      previousSchoolLocation: 'Dinsho', lastGradeCompleted: 'Grade 8',
      completionYear: '2024', previousStudentId: '', transferReason: '', transferCertificateRef: '',
    },
    {
      importRef: 'STU-002', admissionType: 'TRANSFER',
      firstName: 'Abebe', lastName: 'Bekele', gender: 'M',
      dateOfBirth: '2007-07-20', address: 'Robe Town', classroomId: 2,
      previousSchoolName: 'Robe Secondary School', previousSchoolType: 'Secondary',
      previousSchoolLocation: 'Robe', lastGradeCompleted: 'Grade 10',
      completionYear: '2024', previousStudentId: 'ROBE-2022-0042',
      transferReason: 'Family relocation', transferCertificateRef: 'TC-2024-0088',
    },
  ];
  exRows.forEach((data) => {
    const row = ws.addRow(data);
    applyExampleStyle(row);
  });

  // Add a note in the header row comment area
  ws.getCell('A1').note = 'Your own unique identifier for this import batch (e.g. STU-001). Used to link guardians and academic records.';
}

// ── Sheet 3: Guardians ────────────────────────────────────────────────────────

function addGuardiansSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet('Guardians');

  ws.columns = [
    col('importRef',          'ImportRef * (from Students sheet)', 22),
    col('guardianFullName',   'guardianFullName *',                28),
    col('guardianPhoneNumber','guardianPhoneNumber',               20),
    col('relationship',       'relationship *',                    20),
    col('guardianEmail',      'guardianEmail (optional)',          26),
  ];

  applyHeaderStyle(ws.getRow(1));
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // Dropdown for relationship
  for (let i = 2; i <= 502; i++) {
    ws.getCell(`D${i}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"FATHER,MOTHER,GUARDIAN,OTHER"'],
      showErrorMessage: true,
      errorTitle: 'Invalid relationship',
      error: 'Must be FATHER, MOTHER, GUARDIAN, or OTHER',
    };
  }

  const exRows = [
    { importRef: 'STU-001', guardianFullName: 'Amina Ahmed', guardianPhoneNumber: '+251911234567', relationship: 'MOTHER', guardianEmail: '' },
    { importRef: 'STU-002', guardianFullName: 'Tadesse Bekele', guardianPhoneNumber: '+251922345678', relationship: 'FATHER', guardianEmail: 'tadesse@example.com' },
  ];
  exRows.forEach((data) => {
    const row = ws.addRow(data);
    applyExampleStyle(row);
  });
}

// ── Sheet 4: Previous Academic ────────────────────────────────────────────────

function addPrevAcademicSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet('PrevAcademic');

  ws.columns = [
    col('importRef',        'ImportRef * (from Students sheet)', 22),
    col('subjectName',      'subjectName *',                     24),
    col('mark',             'mark (0–100)',                      14),
    col('grade',            'grade (e.g. A, B, C)',              18),
    col('overallAverage',   'overallAverage (leave blank if using per-subject marks)', 38),
    col('notes',            'notes',                             30),
  ];

  applyHeaderStyle(ws.getRow(1));
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // Number validation for mark column
  for (let i = 2; i <= 1002; i++) {
    ws.getCell(`C${i}`).dataValidation = {
      type: 'decimal',
      operator: 'between',
      formulae: ['0', '100'],
      allowBlank: true,
      showErrorMessage: true,
      error: 'Mark must be between 0 and 100',
    };
  }

  const exRows = [
    { importRef: 'STU-001', subjectName: 'Mathematics', mark: 85, grade: 'A', overallAverage: '', notes: '' },
    { importRef: 'STU-001', subjectName: 'English',     mark: 78, grade: 'B', overallAverage: '', notes: '' },
    { importRef: 'STU-001', subjectName: 'Science',     mark: 92, grade: 'A', overallAverage: 85, notes: 'Grade 8 results from Dinsho Primary' },
    { importRef: 'STU-002', subjectName: 'Mathematics', mark: 74, grade: 'B', overallAverage: '', notes: '' },
    { importRef: 'STU-002', subjectName: 'Physics',     mark: 68, grade: 'C', overallAverage: 71, notes: 'Grade 10 results from Robe Secondary' },
  ];
  exRows.forEach((data) => {
    const row = ws.addRow(data);
    applyExampleStyle(row);
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function buildBulkImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DSSSMS';
  wb.created = new Date();
  wb.properties.date1904 = false;

  addInstructionsSheet(wb);
  addStudentsSheet(wb);
  addGuardiansSheet(wb);
  addPrevAcademicSheet(wb);

  // Set Instructions as the active sheet
  wb.views = [{ activeTab: 0, x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, visibility: 'visible' }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
