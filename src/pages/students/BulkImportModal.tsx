/**
 * Bulk Student Import Modal — upgraded to full Excel workbook support.
 *
 * Supports both NEW_STUDENT and TRANSFER admissions with the complete field
 * set matching the individual admission forms.
 */
import { useRef, useState } from 'react';
import ExcelJS from 'exceljs';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useBulkImportStudents } from '../../hooks/useStudents';
import { studentsApi } from '../../lib/students-api';
import { parseDateString, meetsMinimumAdmissionAge, MINIMUM_ADMISSION_AGE } from '../../lib/age';
import type { CreateStudentInput, BulkImportResult } from '../../types/student';
import type { PreviousAcademicSummary, PreviousSubjectMark } from './PreviousAcademicSummaryEditor';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// ── Row shapes read from each Excel sheet ─────────────────────────────────────

interface StudentRow {
  importRef:              string;
  admissionType:          string;
  firstName:              string;
  lastName:               string;
  gender:                 string;
  dateOfBirth:            string;
  address?:               string;
  classroomId:            string | number;
  previousSchoolName?:    string;
  previousSchoolType?:    string;
  previousSchoolLocation?:string;
  lastGradeCompleted?:    string;
  completionYear?:        string;
  previousStudentId?:     string;
  transferReason?:        string;
  transferCertificateRef?:string;
}

interface GuardianRow {
  importRef:              string;
  guardianFullName:       string;
  guardianPhoneNumber?:   string;
  relationship:           string;
  guardianEmail?:         string;
}

interface PrevAcademicRow {
  importRef:      string;
  subjectName:    string;
  mark?:          string | number;
  grade?:         string;
  overallAverage?:string | number;
  notes?:         string;
}

// ── Parse all sheets from an uploaded .xlsx workbook ─────────────────────────

function isExampleRow(importRef: string): boolean {
  return importRef.startsWith('STU-00') && (importRef === 'STU-001' || importRef === 'STU-002');
}

async function parseWorkbook(file: File): Promise<{
  students:    StudentRow[];
  guardians:   GuardianRow[];
  prevAcademic:PrevAcademicRow[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);

  function sheetToObjects(sheetName: string): Record<string, unknown>[] {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) return [];
    const rows: Record<string, unknown>[] = [];
    const headers: string[] = [];
    let headerFound = false;
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) {
        row.eachCell((cell) => headers.push(String(cell.value ?? '').trim()));
        headerFound = true;
        return;
      }
      if (!headerFound) return;
      const obj: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const key = headers[colNum - 1];
        if (key) obj[key] = cell.value ?? '';
      });
      rows.push(obj);
    });
    return rows;
  }

  const rawStudents    = sheetToObjects('Students');
  const rawGuardians   = sheetToObjects('Guardians');
  const rawPrevAcademic= sheetToObjects('PrevAcademic');

  function str(v: unknown): string { return String(v ?? '').trim(); }

  const students = rawStudents
    .map((r) => ({
      importRef:              str(r['ImportRef *'] ?? r['importRef']),
      admissionType:          str(r['admissionType *'] ?? r['admissionType']),
      firstName:              str(r['firstName *'] ?? r['firstName']),
      lastName:               str(r['lastName *'] ?? r['lastName']),
      gender:                 str(r['gender * (M/F)'] ?? r['gender']),
      dateOfBirth:            str(r['dateOfBirth * (YYYY-MM-DD)'] ?? r['dateOfBirth']),
      address:                str(r['address']),
      classroomId:            r['classroomId *'] ?? r['classroomId'],
      previousSchoolName:     str(r['previousSchoolName']),
      previousSchoolType:     str(r['previousSchoolType']),
      previousSchoolLocation: str(r['previousSchoolLocation']),
      lastGradeCompleted:     str(r['lastGradeCompleted']),
      completionYear:         str(r['completionYear (YYYY)'] ?? r['completionYear']),
      previousStudentId:      str(r['previousStudentId']),
      transferReason:         str(r['transferReason']),
      transferCertificateRef: str(r['transferCertificateRef']),
    } as StudentRow))
    .filter((r) => r.importRef && !isExampleRow(r.importRef));

  const guardians = rawGuardians
    .map((r) => ({
      importRef:            str(r['ImportRef * (from Students sheet)'] ?? r['importRef']),
      guardianFullName:     str(r['guardianFullName *'] ?? r['guardianFullName']),
      guardianPhoneNumber:  str(r['guardianPhoneNumber']),
      relationship:         str(r['relationship *'] ?? r['relationship']),
      guardianEmail:        str(r['guardianEmail (optional)'] ?? r['guardianEmail']),
    } as GuardianRow))
    .filter((r) => r.importRef && !isExampleRow(r.importRef));

  const prevAcademic = rawPrevAcademic
    .map((r) => ({
      importRef:      str(r['ImportRef * (from Students sheet)'] ?? r['importRef']),
      subjectName:    str(r['subjectName *'] ?? r['subjectName']),
      mark:           r['mark (0–100)'] ?? r['mark'],
      grade:          str(r['grade (e.g. A, B, C)'] ?? r['grade']),
      overallAverage: r['overallAverage (leave blank if using per-subject marks)'] ?? r['overallAverage'],
      notes:          str(r['notes']),
    } as PrevAcademicRow))
    .filter((r) => r.importRef && !isExampleRow(r.importRef));

  return { students, guardians, prevAcademic };
}

// ── Validate and assemble CreateStudentInput records ─────────────────────────

interface ParseResult {
  valid:  CreateStudentInput[];
  errors: string[];
}

function assembleInputs(
  students:    StudentRow[],
  guardians:   GuardianRow[],
  prevAcademic:PrevAcademicRow[]
): ParseResult {
  const valid: CreateStudentInput[] = [];
  const errors: string[] = [];

  // Build lookup maps
  const guardiansByRef   = new Map<string, GuardianRow[]>();
  const academicByRef    = new Map<string, PrevAcademicRow[]>();

  for (const g of guardians) {
    if (!guardiansByRef.has(g.importRef)) guardiansByRef.set(g.importRef, []);
    guardiansByRef.get(g.importRef)!.push(g);
  }
  for (const a of prevAcademic) {
    if (!academicByRef.has(a.importRef)) academicByRef.set(a.importRef, []);
    academicByRef.get(a.importRef)!.push(a);
  }

  // Check for duplicate ImportRefs in the Students sheet
  const seenRefs = new Set<string>();

  students.forEach((row, idx) => {
    const line = `Students row ${idx + 2}`;

    if (!row.importRef) { errors.push(`${line}: ImportRef is required`); return; }
    if (seenRefs.has(row.importRef)) {
      errors.push(`${line}: Duplicate ImportRef "${row.importRef}"`);
      return;
    }
    seenRefs.add(row.importRef);

    if (!row.firstName) { errors.push(`${line} (${row.importRef}): firstName is required`); return; }
    if (!row.lastName)  { errors.push(`${line} (${row.importRef}): lastName is required`); return; }
    if (row.gender !== 'M' && row.gender !== 'F') {
      errors.push(`${line} (${row.importRef}): gender must be M or F`);
      return;
    }
    if (!row.dateOfBirth) { errors.push(`${line} (${row.importRef}): dateOfBirth is required (YYYY-MM-DD)`); return; }

    // Handle ExcelJS date objects (Excel may return Date objects)
    let dobStr = row.dateOfBirth;
    if (typeof dobStr !== 'string') {
      try {
        const d = new Date(dobStr as unknown as string);
        dobStr = d.toISOString().slice(0, 10);
      } catch {
        errors.push(`${line} (${row.importRef}): dateOfBirth is not a valid date`);
        return;
      }
    }
    const dob = parseDateString(dobStr);
    if (!dob) { errors.push(`${line} (${row.importRef}): dateOfBirth "${dobStr}" is not valid — use YYYY-MM-DD`); return; }
    if (dob > new Date()) { errors.push(`${line} (${row.importRef}): dateOfBirth cannot be in the future`); return; }
    if (!meetsMinimumAdmissionAge(dob)) {
      errors.push(`${line} (${row.importRef}): ${row.firstName} ${row.lastName} must be at least ${MINIMUM_ADMISSION_AGE} years old`);
      return;
    }

    const classroomId = Number(row.classroomId);
    if (!classroomId || isNaN(classroomId) || classroomId <= 0) {
      errors.push(`${line} (${row.importRef}): classroomId must be a valid positive number`);
      return;
    }

    const admType = row.admissionType?.trim();
    if (admType !== 'NEW_STUDENT' && admType !== 'TRANSFER') {
      errors.push(`${line} (${row.importRef}): admissionType must be NEW_STUDENT or TRANSFER`);
      return;
    }

    // Transfer-specific required fields
    if (admType === 'TRANSFER') {
      if (!row.previousSchoolName) {
        errors.push(`${line} (${row.importRef}): previousSchoolName is required for TRANSFER admissions`);
        return;
      }
      if (!row.lastGradeCompleted) {
        errors.push(`${line} (${row.importRef}): lastGradeCompleted is required for TRANSFER admissions`);
        return;
      }
    }

    // Build parents array
    const gRows = guardiansByRef.get(row.importRef) ?? [];
    const guardianErrors: string[] = [];
    const parents: CreateStudentInput['parents'] = [];

    gRows.forEach((g, gi) => {
      if (!g.guardianFullName) {
        guardianErrors.push(`Guardians row for ${row.importRef} #${gi + 1}: guardianFullName is required`);
        return;
      }
      const rel = g.relationship?.toUpperCase();
      if (!['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'].includes(rel)) {
        guardianErrors.push(`Guardians row for ${row.importRef}: relationship "${g.relationship}" is invalid (use FATHER, MOTHER, GUARDIAN, or OTHER)`);
        return;
      }
      parents.push({
        newParent: {
          fullName: g.guardianFullName,
          phoneNumber: g.guardianPhoneNumber || undefined,
          email: g.guardianEmail || undefined,
        },
        relationship: rel as 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER',
      });
    });

    if (guardianErrors.length > 0) {
      errors.push(...guardianErrors);
      return;
    }

    // Build previousAcademicSummary
    const aRows = academicByRef.get(row.importRef) ?? [];
    let prevAcademicSummary: PreviousAcademicSummary | undefined;

    if (aRows.length > 0) {
      const subjects: PreviousSubjectMark[] = [];
      let overallAverage: number | '' = '';
      let notes = '';

      aRows.forEach((a) => {
        if (a.subjectName) {
          const markNum = a.mark !== '' && a.mark !== null && a.mark !== undefined ? Number(a.mark) : '';
          subjects.push({ subjectName: a.subjectName, mark: markNum, grade: a.grade ?? '' });
        }
        if (a.overallAverage !== '' && a.overallAverage != null) overallAverage = Number(a.overallAverage);
        if (a.notes) notes = a.notes;
      });

      prevAcademicSummary = { subjects, overallAverage: overallAverage || undefined, notes: notes || undefined };
    }

    valid.push({
      admissionType:          admType as 'NEW_STUDENT' | 'TRANSFER',
      firstName:              row.firstName.trim(),
      lastName:               row.lastName.trim(),
      gender:                 row.gender as 'M' | 'F',
      dateOfBirth:            dobStr,
      address:                row.address || undefined,
      classroomId,
      previousSchoolName:     row.previousSchoolName || undefined,
      previousSchoolType:     row.previousSchoolType || undefined,
      previousSchoolLocation: row.previousSchoolLocation || undefined,
      lastGradeCompleted:     row.lastGradeCompleted || undefined,
      completionYear:         row.completionYear || undefined,
      previousStudentId:      row.previousStudentId || undefined,
      transferReason:         row.transferReason || undefined,
      transferCertificateRef: row.transferCertificateRef || undefined,
      previousAcademicSummary: prevAcademicSummary,
      parents:                parents.length > 0 ? parents : undefined,
    });
  });

  return { valid, errors };
}

// ── Component ─────────────────────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'result';

export function BulkImportModal({ isOpen, onClose }: Props) {
  const bulkImport    = useBulkImportStudents();
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const [step, setStep]               = useState<Step>('upload');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [validRows, setValidRows]     = useState<CreateStudentInput[]>([]);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isTemplateLoading, setTemplateLoading] = useState(false);
  const [isParsing, setParsing]       = useState(false);

  async function handleDownloadTemplate() {
    setTemplateLoading(true);
    try {
      await studentsApi.downloadBulkImportTemplate();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not download template.');
    } finally {
      setTemplateLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Accept both .xlsx and legacy .csv
    if (file.name.endsWith('.csv')) {
      setParseErrors(['Please use the Excel (.xlsx) template. CSV is no longer supported for bulk import.']);
      setValidRows([]);
      setStep('preview');
      return;
    }

    setParsing(true);
    try {
      const { students, guardians, prevAcademic } = await parseWorkbook(file);

      if (students.length === 0) {
        setParseErrors(['No student rows found. Make sure you are using the correct template and have deleted the example rows.']);
        setValidRows([]);
        setStep('preview');
        return;
      }

      const { valid, errors } = assembleInputs(students, guardians, prevAcademic);
      setParseErrors(errors);
      setValidRows(valid);
      setStep('preview');
    } catch (err) {
      setParseErrors([
        'Could not read the Excel file. Make sure you are uploading the correct .xlsx template.',
        ...(err instanceof Error ? [err.message] : []),
      ]);
      setValidRows([]);
      setStep('preview');
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirmImport() {
    if (!validRows.length) return;
    setServerError(null);
    try {
      const result = await bulkImport.mutateAsync(validRows);
      setImportResult(result);
      setStep('result');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Bulk import failed.');
    }
  }

  function handleClose() {
    setStep('upload');
    setParseErrors([]);
    setValidRows([]);
    setImportResult(null);
    setServerError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  }

  return (
    <Modal title="Bulk Student Admission" isOpen={isOpen} onClose={handleClose} widthClassName="max-w-[760px]">

      {/* ── Step: Upload ── */}
      {step === 'upload' && (
        <div>
          <p className="mb-4 text-sm text-slate-600">
            Admit multiple students at once using the Excel template.
            The template supports both <strong>new Grade 9 admissions</strong> and <strong>transfer students</strong> (Grades 10–12)
            with the same fields and validation as individual admission.
          </p>

          <div className="mb-5 rounded-lg border border-pine-200 bg-pine-50 px-4 py-3 text-sm text-pine-800">
            <strong>Workbook structure:</strong>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li><strong>Students</strong> — one row per student, all personal and school information</li>
              <li><strong>Guardians</strong> — one row per guardian (linked by ImportRef)</li>
              <li><strong>PrevAcademic</strong> — one row per subject result (linked by ImportRef)</li>
              <li><strong>Instructions</strong> — full field guide and validation rules</li>
            </ul>
          </div>

          <div className="mb-5 flex gap-3">
            <Button variant="secondary" onClick={() => void handleDownloadTemplate()} isLoading={isTemplateLoading}>
              Download Excel template (.xlsx)
            </Button>
          </div>

          <label className="mb-1 block text-sm font-medium text-ink-700">
            Upload completed workbook (.xlsx)
          </label>
          {isParsing ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
              Reading workbook…
            </div>
          ) : (
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-pine-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-pine-700 hover:file:bg-pine-100"
              onChange={(e) => void handleFileChange(e)}
            />
          )}

          {serverError && (
            <p className="mt-3 text-sm text-danger-600">{serverError}</p>
          )}

          <div className="mt-6 flex justify-end">
            <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Step: Preview ── */}
      {step === 'preview' && (
        <div>
          {parseErrors.length > 0 && (
            <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 p-3">
              <p className="mb-1 text-sm font-semibold text-danger-700">
                {parseErrors.length} validation error{parseErrors.length !== 1 ? 's' : ''}:
              </p>
              <ul className="max-h-40 overflow-y-auto list-inside list-disc text-sm text-danger-600">
                {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {validRows.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm text-slate-600">
                <strong>{validRows.length}</strong> valid student record{validRows.length !== 1 ? 's' : ''} ready to import:
              </p>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Gender</th>
                      <th className="px-3 py-2">D.O.B</th>
                      <th className="px-3 py-2">Classroom</th>
                      <th className="px-3 py-2">Guardian(s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-1.5 font-medium">{r.firstName} {r.lastName}</td>
                        <td className="px-3 py-1.5 text-xs">{r.admissionType === 'TRANSFER' ? 'Transfer' : 'New'}</td>
                        <td className="px-3 py-1.5">{r.gender === 'M' ? 'M' : 'F'}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{r.dateOfBirth}</td>
                        <td className="px-3 py-1.5">{r.classroomId}</td>
                        <td className="px-3 py-1.5 text-slate-500">
                          {r.parents?.length ? r.parents.map((p) => p.newParent?.fullName).join(', ') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {serverError && (
            <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
              {serverError}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setStep('upload'); setParseErrors([]); setValidRows([]); }}>
              Back
            </Button>
            <Button
              onClick={() => void handleConfirmImport()}
              isLoading={bulkImport.isPending}
              disabled={validRows.length === 0}
            >
              Import {validRows.length > 0 ? `${validRows.length} student${validRows.length !== 1 ? 's' : ''}` : ''}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step: Result ── */}
      {step === 'result' && importResult && (
        <div>
          <div className={`mb-4 rounded-lg p-4 ${importResult.successCount > 0 ? 'bg-pine-50 border border-pine-200' : 'bg-slate-50'}`}>
            <p className="text-base font-semibold text-pine-800">
              ✓ {importResult.successCount} student{importResult.successCount !== 1 ? 's' : ''} admitted successfully
            </p>
          </div>

          {importResult.errors.length > 0 && (
            <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 p-3">
              <p className="mb-2 text-sm font-semibold text-danger-700">
                {importResult.errors.length} record{importResult.errors.length !== 1 ? 's' : ''} failed:
              </p>
              <ul className="list-inside list-disc text-sm text-danger-600">
                {importResult.errors.map((e, i) => (
                  <li key={i}><strong>{e.student}</strong>: {e.error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
