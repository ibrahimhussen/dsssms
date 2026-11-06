/**
 * Bulk Student Import Modal — upgraded to full Excel workbook support.
 *
 * The workbook is parsed on the server (POST /students/bulk/parse) so that
 * ExcelJS runs in Node, not in the browser bundle.  The server returns
 * { valid: CreateStudentInput[], errors: string[] } which we preview here
 * before calling the existing /students/bulk endpoint for the actual import.
 *
 * Supports both NEW_STUDENT and TRANSFER admissions with the complete field
 * set matching the individual admission forms.
 */
import { useRef, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useBulkImportStudents } from '../../hooks/useStudents';
import { studentsApi } from '../../lib/students-api';
import type { CreateStudentInput, BulkImportResult } from '../../types/student';

interface Props {
  isOpen: boolean;
  onClose: () => void;
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

    if (file.name.endsWith('.csv')) {
      setParseErrors(['Please use the Excel (.xlsx) template. CSV is no longer supported for bulk import.']);
      setValidRows([]);
      setStep('preview');
      return;
    }

    setParsing(true);
    try {
      const { valid, errors } = await studentsApi.parseBulkImportWorkbook(file);
      if (valid.length === 0 && errors.length === 0) {
        setParseErrors(['No student rows found. Make sure you are using the correct template and have deleted the example rows.']);
      } else {
        setParseErrors(errors);
      }
      setValidRows(valid);
      setStep('preview');
    } catch (err) {
      setParseErrors([
        'Could not parse the Excel file. Make sure you are uploading the correct .xlsx template.',
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
