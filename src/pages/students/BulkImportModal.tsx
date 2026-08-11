import { useRef, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useBulkImportStudents } from '../../hooks/useStudents';
import type { CreateStudentInput, BulkImportResult } from '../../types/student';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** The shape of each row in the CSV import template */
type ImportRow = {
  firstName: string;
  lastName: string;
  gender: 'M' | 'F';
  dateOfBirth: string; // YYYY-MM-DD
  classroomId: number;
  address?: string;
  previousSchoolName?: string;
  previousSchoolType?: string;
  previousSchoolLocation?: string;
  lastGradeCompleted?: string;
  completionYear?: string;
};

const TEMPLATE_ROWS: ImportRow[] = [
  {
    firstName: 'Fatima',
    lastName: 'Ahmed',
    gender: 'F',
    dateOfBirth: '2010-03-15',
    classroomId: 1,
    previousSchoolName: 'Dinsho Primary School',
    previousSchoolType: 'Primary',
    lastGradeCompleted: 'Grade 8',
    completionYear: '2024',
  },
];

function downloadTemplate() {
  const headers = Object.keys(TEMPLATE_ROWS[0]).join(',');
  const row = Object.values(TEMPLATE_ROWS[0]).map(val => `"${val}"`).join(',');
  const csv = `${headers}\n${row}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'students_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const results = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    results.push(obj);
  }
  return results;
}

function validateRows(rows: unknown[]): { valid: CreateStudentInput[]; errors: string[] } {
  const valid: CreateStudentInput[] = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const r = row as Record<string, string>;
    const lineNum = idx + 1;

    if (!r.firstName || r.firstName.trim() === '') {
      errors.push(`Row ${lineNum}: Missing "firstName"`);
      return;
    }
    if (!r.lastName || r.lastName.trim() === '') {
      errors.push(`Row ${lineNum}: Missing "lastName"`);
      return;
    }
    if (r.gender !== 'M' && r.gender !== 'F') {
      errors.push(`Row ${lineNum}: "gender" must be "M" or "F"`);
      return;
    }
    if (!r.dateOfBirth || r.dateOfBirth.trim() === '') {
      errors.push(`Row ${lineNum}: Missing "dateOfBirth" (use YYYY-MM-DD)`);
      return;
    }
    const classroomId = parseInt(r.classroomId, 10);
    if (isNaN(classroomId) || classroomId <= 0) {
      errors.push(`Row ${lineNum}: Missing or invalid "classroomId" (must be a number)`);
      return;
    }

    valid.push({
      admissionType: 'NEW_STUDENT',
      firstName: r.firstName,
      lastName: r.lastName,
      gender: r.gender as 'M' | 'F',
      dateOfBirth: r.dateOfBirth,
      classroomId: classroomId,
      address: r.address || undefined,
      previousSchoolName: r.previousSchoolName || undefined,
      previousSchoolType: r.previousSchoolType || undefined,
      previousSchoolLocation: r.previousSchoolLocation || undefined,
      lastGradeCompleted: r.lastGradeCompleted || undefined,
      completionYear: r.completionYear || undefined,
      previousStudentId: r.previousStudentId || undefined,
    });
  });

  return { valid, errors };
}

type Step = 'upload' | 'preview' | 'result';

export function BulkImportModal({ isOpen, onClose }: Props) {
  const bulkImport = useBulkImportStudents();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [validRows, setValidRows] = useState<CreateStudentInput[]>([]);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rawText = ev.target?.result as string;
        const parsed = parseCSV(rawText);
        const { valid, errors } = validateRows(parsed);
        setParseErrors(errors);
        setValidRows(valid);
        setStep('preview');
      } catch (err) {
        setParseErrors(['Invalid CSV file. Please use the template provided.']);
        setValidRows([]);
        setStep('preview');
      }
    };
    reader.readAsText(file);
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
    <Modal title="Bulk Import — New Students" isOpen={isOpen} onClose={handleClose} widthClassName="max-w-[700px]">

      {step === 'upload' && (
        <div>
          <p className="mb-4 text-sm text-slate-600">
            Use this tool to admit large numbers of <strong>new students</strong> (e.g. Grade 9 intake) in one operation.
            Download the CSV template, fill it in using Excel or another spreadsheet tool, and upload it below.
          </p>
          <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
            <strong>Note:</strong> For transfer students, use the individual <em>Transfer Student Admission</em> form, as
            each transfer requires verification of previous school records.
          </p>

          <div className="mb-5 flex gap-3">
            <Button variant="secondary" onClick={downloadTemplate}>
              Download CSV template
            </Button>
          </div>

          <label className="block text-sm font-medium text-ink-700 mb-1">
            Upload completed CSV file
          </label>
          <input
            ref={fileInputRef}
            id="bulk-import-file"
            type="file"
            accept=".csv,text/csv"
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-pine-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-pine-700 hover:file:bg-pine-100"
            onChange={handleFileChange}
          />

          <div className="mt-6 flex justify-end">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div>
          {parseErrors.length > 0 && (
            <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 p-3">
              <p className="mb-1 text-sm font-semibold text-danger-700">Validation errors found:</p>
              <ul className="list-inside list-disc text-sm text-danger-600">
                {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {validRows.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm text-slate-600">
                <strong>{validRows.length}</strong> valid student record{validRows.length !== 1 ? 's' : ''} ready to import:
              </p>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Gender</th>
                      <th className="px-3 py-2">D.O.B</th>
                      <th className="px-3 py-2">Classroom ID</th>
                      <th className="px-3 py-2">Prev. School</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-1.5 font-medium">{r.firstName} {r.lastName}</td>
                        <td className="px-3 py-1.5">{r.gender === 'M' ? 'Male' : 'Female'}</td>
                        <td className="px-3 py-1.5">{r.dateOfBirth}</td>
                        <td className="px-3 py-1.5">{r.classroomId}</td>
                        <td className="px-3 py-1.5 text-slate-500">{r.previousSchoolName ?? '—'}</td>
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
            <Button type="button" variant="ghost" onClick={() => { setStep('upload'); setParseErrors([]); setValidRows([]); }}>
              Back
            </Button>
            <Button
              onClick={() => void handleConfirmImport()}
              isLoading={bulkImport.isPending}
              disabled={validRows.length === 0}
            >
              Import {validRows.length} student{validRows.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}

      {step === 'result' && importResult && (
        <div>
          <div className={`mb-4 rounded-lg p-4 ${importResult.successCount > 0 ? 'bg-green-50' : 'bg-slate-50'}`}>
            <p className="text-base font-semibold text-green-700">
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
