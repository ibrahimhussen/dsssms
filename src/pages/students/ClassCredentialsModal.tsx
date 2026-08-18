/**
 * ClassCredentialsModal
 *
 * Two clearly separated operations:
 *
 * 1. GENERATE PASSWORDS (for students who haven't set a personal password yet)
 *    - Only processes students whose isTemporaryPassword = true
 *    - Safe to run multiple times — already-processed students are skipped
 *    - Shows: total / generated / skipped
 *
 * 2. RESET ALL PASSWORDS (force-reset every active student)
 *    - Separate, clearly labelled destructive operation
 *    - Requires explicit confirmation
 *    - Use case: forgotten credentials, class-wide re-provisioning
 *
 * Passwords are shown ONCE after generation/reset and never again.
 * They are not stored as plaintext anywhere.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MdDownload, MdPrint, MdKey, MdRefresh,
  MdCheckCircle, MdWarningAmber, MdLock, MdInfo,
} from 'react-icons/md';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { studentsApi } from '../../lib/students-api';
import type { BulkGenerateNewResult } from '../../types/student';

interface Props {
  classroomId:    number | null;
  classroomLabel: string;
  onClose:        () => void;
}

type OperationResult = BulkGenerateNewResult & { mode: 'generate' | 'reset' };

export function ClassCredentialsModal({ classroomId, classroomLabel, onClose }: Props) {
  // ── State ───────────────────────────────────────────────────────────────────
  const [confirmMode, setConfirmMode]   = useState<'generate' | 'reset' | null>(null);
  const [isWorking, setIsWorking]       = useState(false);
  const [workError, setWorkError]       = useState<string | null>(null);
  const [result, setResult]             = useState<OperationResult | null>(null);

  // ── Preview: how many students need passwords generated ────────────────────
  const { data: preview, isLoading: previewLoading, refetch: refetchPreview } = useQuery({
    queryKey: ['students', 'generate-preview', classroomId],
    queryFn:  () => studentsApi.previewGeneratePasswords(classroomId!),
    enabled:  classroomId !== null && result === null,
  });

  // ── Execute operations ─────────────────────────────────────────────────────
  async function execute(mode: 'generate' | 'reset') {
    if (!classroomId) return;
    setIsWorking(true);
    setWorkError(null);
    try {
      const raw = mode === 'generate'
        ? await studentsApi.bulkGenerateNewPasswords(classroomId)
        : await studentsApi.bulkGenerateClassroomPasswords(classroomId);
      setResult({ ...raw, mode });
      setConfirmMode(null);
    } catch (err) {
      setWorkError(err instanceof Error ? err.message : 'Operation failed. Please try again.');
    } finally {
      setIsWorking(false);
    }
  }

  // ── CSV download ───────────────────────────────────────────────────────────
  function downloadCsv() {
    if (!result?.results.length) return;
    const header = 'Student ID,Full Name,Username,Temporary Password';
    const rows = result.results.map((s) =>
      `${s.admissionNumber},"${s.firstName} ${s.lastName}",${s.username},${s.temporaryPassword}`
    );
    const csv = [header, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `credentials-${classroomLabel.replace(/\s/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // ── Print ──────────────────────────────────────────────────────────────────
  function handlePrint() {
    if (!result?.results.length) return;
    const rows = result.results.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${s.firstName} ${s.lastName}</td>
        <td class="mono">${s.username}</td>
        <td class="mono pw">${s.temporaryPassword}</td>
        <td class="note">Change on first login</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
    <title>Credentials — ${classroomLabel}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:10pt;padding:20px}
      h2{margin-bottom:4px;font-size:14pt}
      .sub{font-size:9pt;color:#555;margin-bottom:12px}
      .warning{background:#fff3cd;border:1px solid #ffc107;padding:8px 12px;
               border-radius:4px;font-size:8.5pt;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;font-size:9pt}
      th{background:#1a2e1a;color:white;padding:6px 8px;text-align:left}
      td{border-bottom:1px solid #ddd;padding:5px 8px}
      tr:nth-child(even) td{background:#f8f8f8}
      .mono{font-family:monospace}
      .pw{color:#0e4b2e;font-weight:bold;letter-spacing:0.5px}
      .note{color:#888;font-style:italic;font-size:8pt}
      @media print{body{padding:8px}}
    </style></head><body>
    <h2>Student Login Credentials — ${classroomLabel}</h2>
    <div class="sub">
      Generated: ${new Date().toLocaleDateString()} &nbsp;·&nbsp;
      DSSSMS — Dinsho Secondary School
    </div>
    <div class="warning">
      ⚠ Confidential — For authorized distribution only.
      Students must change their password on first login.
      Do not share publicly.
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>Student Name</th>
        <th>Username (Student ID)</th>
        <th>Temporary Password</th>
        <th>Note</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  // ── Reset view ─────────────────────────────────────────────────────────────
  function handleReset() {
    setResult(null);
    setWorkError(null);
    void refetchPreview();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      title={`Student Credentials — ${classroomLabel}`}
      isOpen={classroomId !== null}
      onClose={onClose}
      widthClassName="max-w-[780px]"
    >
      {/* Security notice */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2.5">
        <MdLock className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
        <p className="text-sm text-gold-700">
          <strong>Confidential.</strong> Each student's username is their Student ID.
          Temporary passwords are shown <strong>only once</strong> — export or print immediately.
          Admin must never share this document publicly.
        </p>
      </div>

      {/* ── Result view ── */}
      {result && (
        <>
          {/* Summary */}
          <div className="mb-4 rounded-xl border border-pine-200 bg-pine-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MdCheckCircle className="h-5 w-5 text-pine-700" />
              <p className="font-semibold text-pine-800">
                {result.mode === 'generate' ? 'Password generation complete' : 'Password reset complete'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              <div><span className="text-slate-500">Total students</span><p className="font-bold text-ink-900">{result.total}</p></div>
              <div><span className="text-slate-500">Passwords generated</span><p className="font-bold text-pine-700">{result.generated}</p></div>
              <div><span className="text-slate-500">Skipped</span><p className="font-bold text-slate-500">{result.skipped}</p></div>
              <div><span className="text-slate-500">Failed</span><p className={`font-bold ${result.failed > 0 ? 'text-danger-600' : 'text-slate-400'}`}>{result.failed}</p></div>
            </div>
            {result.mode === 'generate' && result.skipped > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                {result.skipped} student(s) skipped — they have already set a personal password.
                Use <strong>Reset All Passwords</strong> to force-replace their credentials.
              </p>
            )}
            <p className="mt-2 text-xs font-semibold text-danger-600">
              ⚠ These passwords will NOT be shown again. Export or print now.
            </p>
          </div>

          {/* Action bar */}
          <div className="mb-3 flex flex-wrap gap-2 justify-between items-center">
            <button type="button" onClick={handleReset} className="text-xs text-slate-500 underline hover:text-slate-700">
              ← Back to classroom overview
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handlePrint}>
                <MdPrint className="h-4 w-4" /> Print
              </Button>
              <Button onClick={downloadCsv} disabled={!result.results.length}>
                <MdDownload className="h-4 w-4" /> Download CSV
              </Button>
            </div>
          </div>

          {/* Credentials table */}
          {result.results.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No new credentials were generated.
            </p>
          ) : (
            <div className="max-h-[45vh] overflow-y-auto overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-paper-100">
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-700">
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Student Name</th>
                    <th className="px-4 py-2.5">Username (Student ID)</th>
                    <th className="px-4 py-2.5">Temporary Password</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((s, i) => (
                    <tr key={s.studentId} className="border-t border-slate-100 hover:bg-paper-50">
                      <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-ink-900">{s.firstName} {s.lastName}</td>
                      <td className="px-4 py-2.5 font-mono text-pine-700 font-semibold">{s.username}</td>
                      <td className="px-4 py-2.5 font-mono text-base font-bold text-ink-900 tracking-wider">{s.temporaryPassword}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Initial / preview view ── */}
      {!result && (
        <>
          {/* Preview stats */}
          {previewLoading ? (
            <div className="flex items-center gap-2 py-6 text-slate-500 text-sm">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700" />
              Loading classroom data…
            </div>
          ) : preview ? (
            <div className="mb-5 grid grid-cols-3 gap-3">
              {[
                { label: 'Total students', value: preview.total, color: '' },
                { label: 'Need passwords', value: preview.eligible, color: 'text-pine-700', note: '(no personal password set yet)' },
                { label: 'Have personal password', value: preview.alreadyPersonal, color: 'text-slate-500', note: '(changed from temporary)' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[0.7rem] uppercase tracking-wide text-slate-400">{s.label}</p>
                  <p className={`text-2xl font-bold text-ink-900 ${s.color}`}>{s.value}</p>
                  {s.note && <p className="text-[0.7rem] text-slate-400 mt-0.5">{s.note}</p>}
                </div>
              ))}
            </div>
          ) : null}

          {workError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2.5">
              <MdWarningAmber className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
              <p className="text-sm text-danger-700">{workError}</p>
            </div>
          )}

          {/* Two clearly separated operation buttons */}
          <div className="flex flex-col gap-3">

            {/* Operation 1 — Generate for students without personal password */}
            <div className="rounded-xl border border-pine-200 bg-pine-50/50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-pine-900 flex items-center gap-1.5">
                    <MdKey className="h-4 w-4" />
                    Generate Temporary Passwords
                  </p>
                  <p className="mt-1 text-sm text-pine-800/80">
                    Generates passwords <strong>only for students who have not yet set a personal password</strong>{' '}
                    ({preview?.eligible ?? '?'} student{preview?.eligible !== 1 ? 's' : ''}).
                    Students who already changed their password are <strong>not affected</strong>.
                  </p>
                  <p className="mt-1 text-xs text-pine-700/70">
                    Safe to run multiple times — already-generated students are automatically skipped.
                  </p>
                </div>
                <Button
                  onClick={() => setConfirmMode('generate')}
                  disabled={!preview || preview.eligible === 0}
                  className="shrink-0"
                >
                  Generate Passwords
                </Button>
              </div>
            </div>

            {/* Operation 2 — Reset ALL passwords */}
            <div className="rounded-xl border border-danger-200 bg-danger-50/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-danger-800 flex items-center gap-1.5">
                    <MdRefresh className="h-4 w-4" />
                    Reset All Passwords
                  </p>
                  <p className="mt-1 text-sm text-danger-700/80">
                    Resets passwords for <strong>all {preview?.total ?? ''} active students</strong>,
                    including those who already set a personal password.
                    All current sessions will be invalidated.
                  </p>
                  <p className="mt-1 text-xs text-danger-600/70">
                    Use only when all students need new credentials (e.g. security incident, class re-registration).
                  </p>
                </div>
                <Button
                  variant="danger"
                  onClick={() => setConfirmMode('reset')}
                  disabled={!preview || preview.total === 0}
                  className="shrink-0"
                >
                  Reset All
                </Button>
              </div>
            </div>

          </div>
        </>
      )}

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>

      {/* ── Confirm: generate ── */}
      <ConfirmDialog
        isOpen={confirmMode === 'generate'}
        title="Generate temporary passwords"
        message={[
          `Classroom: ${classroomLabel}`,
          ``,
          `Students who need passwords: ${preview?.eligible ?? 0}`,
          `Students with personal passwords (will be skipped): ${preview?.alreadyPersonal ?? 0}`,
          ``,
          `This will generate a new temporary password for ${preview?.eligible ?? 0} student(s).`,
          `Students who already set a personal password are NOT affected.`,
        ].join('\n')}
        confirmLabel="Generate Passwords"
        isDangerous={false}
        isLoading={isWorking}
        onConfirm={() => void execute('generate')}
        onCancel={() => setConfirmMode(null)}
      />

      {/* ── Confirm: reset all ── */}
      <ConfirmDialog
        isOpen={confirmMode === 'reset'}
        title="Reset ALL student passwords?"
        message={[
          `Classroom: ${classroomLabel}`,
          ``,
          `This will reset passwords for ALL ${preview?.total ?? 0} active students,`,
          `including the ${preview?.alreadyPersonal ?? 0} student(s) who already set a personal password.`,
          ``,
          `All active sessions will be invalidated.`,
          `This action is recorded in the audit log.`,
          ``,
          `Are you sure you want to continue?`,
        ].join('\n')}
        confirmLabel="Yes, Reset All Passwords"
        isDangerous={true}
        isLoading={isWorking}
        onConfirm={() => void execute('reset')}
        onCancel={() => setConfirmMode(null)}
      />
    </Modal>
  );
}
