/**
 * Parses the uploaded bulk-import Excel workbook and assembles
 * CreateStudentInput records using the same validation as individual admission.
 *
 * Called server-side so no ExcelJS browser-bundle issues.
 */
import ExcelJS from 'exceljs';
import { meetsMinimumAdmissionAge, MINIMUM_ADMISSION_AGE } from '../../core/utils/age.util';
import type { CreateStudentInput } from './validation/student.validation';

interface PreviousAcademicSummary {
  subjects: { subjectName: string; mark: number | ''; grade: string }[];
  overallAverage?: number;
  notes?: string;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'text' in (v as object)) return String((v as { text: string }).text);
  if (typeof v === 'object' && 'result' in (v as object)) return String((v as { result: unknown }).result);
  return String(v).trim();
}

function isExampleRef(ref: string): boolean {
  return ref === 'STU-001' || ref === 'STU-002';
}

function sheetToRecords(ws: ExcelJS.Worksheet): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const headers: string[] = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) {
      row.eachCell((cell) => headers.push(str(cell.value)));
      return;
    }
    const obj: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const key = headers[col - 1];
      if (key) obj[key] = cell.value;
    });
    rows.push(obj);
  });
  return rows;
}

export interface ParseBulkWorkbookResult {
  valid:  CreateStudentInput[];
  errors: string[];
}

export async function parseBulkImportWorkbook(buffer: Buffer): Promise<ParseBulkWorkbookResult> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS declares its own global `Buffer extends ArrayBuffer` which conflicts
  // with @types/node's `Buffer<TArrayBuffer>` generic at the type level.
  // Runtime is fine — Node Buffer works with ExcelJS.load().
  // @ts-expect-error — see https://github.com/exceljs/exceljs type declarations
  await wb.xlsx.load(buffer);

  const studentsWs    = wb.getWorksheet('Students');
  const guardiansWs   = wb.getWorksheet('Guardians');
  const prevAcademicWs= wb.getWorksheet('PrevAcademic');

  if (!studentsWs) {
    return { valid: [], errors: ['Workbook is missing the "Students" worksheet. Please use the official template.'] };
  }

  const studentRaws     = sheetToRecords(studentsWs);
  const guardianRaws    = guardiansWs    ? sheetToRecords(guardiansWs)    : [];
  const prevAcademicRaws= prevAcademicWs ? sheetToRecords(prevAcademicWs) : [];

  // Normalize column names — template headers are already camelCase but contain
  // decoration (asterisks, parenthetical hints). Strip the decoration and lowercase
  // the first character to match the keys the parser expects.
  function normalize(rows: Record<string, unknown>[]): Record<string, string>[] {
    return rows.map((r) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) {
        const clean = k.replace(/\s*\*.*$/, '').replace(/\(.*\)/, '').trim();
        const key = clean.charAt(0).toLowerCase() + clean.slice(1);
        if (key) out[key] = str(v);
      }
      return out;
    });
  }

  const students    = normalize(studentRaws).filter((r) => r['importRef'] && !isExampleRef(r['importRef']));
  const guardians   = normalize(guardianRaws).filter((r) => r['importRef'] && !isExampleRef(r['importRef']));
  const prevAcademic= normalize(prevAcademicRaws).filter((r) => r['importRef'] && !isExampleRef(r['importRef']));

  // Build lookup maps indexed by importRef
  const guardiansByRef   = new Map<string, typeof guardians>();
  const academicByRef    = new Map<string, typeof prevAcademic>();

  for (const g of guardians) {
    const ref = g['importRef'] || g['importRef*FromStudentsSheet'] || '';
    if (!ref) continue;
    if (!guardiansByRef.has(ref)) guardiansByRef.set(ref, []);
    guardiansByRef.get(ref)!.push(g);
  }
  for (const a of prevAcademic) {
    const ref = a['importRef'] || a['importRef*FromStudentsSheet'] || '';
    if (!ref) continue;
    if (!academicByRef.has(ref)) academicByRef.set(ref, []);
    academicByRef.get(ref)!.push(a);
  }

  const valid: CreateStudentInput[] = [];
  const errors: string[] = [];
  const seenRefs = new Set<string>();

  students.forEach((row, idx) => {
    const line = `Students row ${idx + 2}`;
    const ref  = row['importRef'] || '';

    if (!ref) { errors.push(`${line}: ImportRef is required`); return; }
    if (seenRefs.has(ref)) { errors.push(`${line}: Duplicate ImportRef "${ref}"`); return; }
    seenRefs.add(ref);

    if (!row['firstName']) { errors.push(`${line} (${ref}): firstName is required`); return; }
    if (!row['lastName'])  { errors.push(`${line} (${ref}): lastName is required`); return; }
    const gender = row['gender'] || row['genderMF'] || '';
    if (gender !== 'M' && gender !== 'F') {
      errors.push(`${line} (${ref}): gender must be M or F (got "${gender}")`); return;
    }
    const dobRaw = row['dateOfBirth'] || row['dateOfBirthYYYYMMDD'] || '';
    if (!dobRaw) { errors.push(`${line} (${ref}): dateOfBirth is required`); return; }

    // Parse the date — ExcelJS converts Excel serial dates to JS Date objects,
    // but cells formatted as text may arrive as strings.
    let dobDate: Date;
    try {
      dobDate = new Date(dobRaw);
    } catch {
      errors.push(`${line} (${ref}): dateOfBirth "${dobRaw}" is not valid — use YYYY-MM-DD`); return;
    }
    if (isNaN(dobDate.getTime())) { errors.push(`${line} (${ref}): dateOfBirth "${dobRaw}" is not valid — use YYYY-MM-DD`); return; }
    if (dobDate > new Date()) { errors.push(`${line} (${ref}): dateOfBirth cannot be in the future`); return; }
    if (!meetsMinimumAdmissionAge(dobDate)) {
      errors.push(`${line} (${ref}): ${row['firstName']} ${row['lastName']} must be at least ${MINIMUM_ADMISSION_AGE} years old`);
      return;
    }

    const classroomId = parseInt(row['classroomId'] || row['classroomId*'] || '', 10);
    if (!classroomId || classroomId <= 0) {
      errors.push(`${line} (${ref}): classroomId must be a valid positive number`); return;
    }

    const admType = (row['admissionType'] || '').trim().toUpperCase();
    if (admType !== 'NEW_STUDENT' && admType !== 'TRANSFER') {
      errors.push(`${line} (${ref}): admissionType must be NEW_STUDENT or TRANSFER`); return;
    }

    if (admType === 'TRANSFER') {
      if (!row['previousSchoolName']) {
        errors.push(`${line} (${ref}): previousSchoolName is required for TRANSFER admissions`); return;
      }
      if (!row['lastGradeCompleted']) {
        errors.push(`${line} (${ref}): lastGradeCompleted is required for TRANSFER admissions`); return;
      }
    }

    // Build parents
    const gRows = guardiansByRef.get(ref) ?? [];
    const parentErrors: string[] = [];
    const parents: CreateStudentInput['parents'] = [];

    gRows.forEach((g, gi) => {
      const name = g['guardianFullName'] || g['guardianFullName*'] || '';
      if (!name) { parentErrors.push(`Guardians (${ref}) #${gi + 1}: guardianFullName is required`); return; }
      const rel = (g['relationship'] || g['relationship*'] || '').toUpperCase();
      if (!['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'].includes(rel)) {
        parentErrors.push(`Guardians (${ref}) #${gi + 1}: relationship "${rel}" is invalid`); return;
      }
      const phone = g['guardianPhoneNumber'] || g['phone'] || '';
      const email = g['guardianEmail'] || g['email'] || '';
      parents.push({
        newParent: { fullName: name, phoneNumber: phone || undefined, email: email || undefined },
        relationship: rel as 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER',
      });
    });

    if (parentErrors.length) { errors.push(...parentErrors); return; }

    // Build previousAcademicSummary
    const aRows = academicByRef.get(ref) ?? [];
    let prevSummary: PreviousAcademicSummary | undefined;

    if (aRows.length > 0) {
      const subjects: PreviousAcademicSummary['subjects'] = [];
      let overallAverage: number | undefined;
      let notes: string | undefined;

      for (const a of aRows) {
        const subj = a['subjectName'] || a['subjectName*'] || '';
        if (subj) {
          const markRaw = a['mark'] || a['mark0100'] || '';
          const mark = markRaw !== '' ? Number(markRaw) : '';
          subjects.push({ subjectName: subj, mark, grade: a['grade'] || '' });
        }
        const oa = a['overallAverage'] || a['overallAverageLea'] || '';
        if (oa !== '') overallAverage = Number(oa);
        if (a['notes']) notes = a['notes'];
      }

      if (subjects.length > 0 || overallAverage !== undefined) {
        prevSummary = { subjects, overallAverage, notes };
      }
    }

    valid.push({
      admissionType:          admType as 'NEW_STUDENT' | 'TRANSFER',
      firstName:              row['firstName'].trim(),
      lastName:               row['lastName'].trim(),
      gender:                 gender as 'M' | 'F',
      dateOfBirth:            dobDate,
      address:                row['address'] || undefined,
      classroomId,
      previousSchoolName:     row['previousSchoolName'] || undefined,
      previousSchoolType:     row['previousSchoolType'] || undefined,
      previousSchoolLocation: row['previousSchoolLocation'] || undefined,
      lastGradeCompleted:     row['lastGradeCompleted'] || undefined,
      completionYear:         row['completionYear'] || undefined,
      previousStudentId:      row['previousStudentId'] || undefined,
      transferReason:         row['transferReason'] || undefined,
      transferCertificateRef: row['transferCertificateRef'] || undefined,
      previousAcademicSummary: prevSummary,
      parents: parents.length > 0 ? parents : undefined,
    });
  });

  return { valid, errors };
}
