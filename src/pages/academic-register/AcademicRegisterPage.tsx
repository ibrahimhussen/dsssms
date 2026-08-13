import { useRef, useState } from 'react';
import {
  MdPrint,
  MdDownload,
  MdWarningAmber,
  MdCheckCircle,
  MdInfoOutline,
} from 'react-icons/md';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { useAcademicRegister } from '../../hooks/useAcademicRegister';
import { academicRegisterApi } from '../../lib/academic-register-api';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import type {
  AcademicRegisterQuery,
  AcademicRegisterStudent,
  RegisterViewMode,
} from '../../types/academic-register';

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentAcademicYear(): string {
  const y = new Date().getFullYear();
  return `${y}/${String(y + 1).slice(2)}`;
}

function viewModeLabel(mode: RegisterViewMode): string {
  switch (mode) {
    case 'SEMESTER_1': return 'Semester 1';
    case 'SEMESTER_2': return 'Semester 2';
    case 'FULL_YEAR':  return 'Full Year';
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'PASS':       return <Badge tone="positive">Pass</Badge>;
    case 'FAIL':       return <Badge tone="danger">Fail</Badge>;
    case 'INCOMPLETE': return <Badge tone="warning">Incomplete</Badge>;
    case 'PENDING':    return <Badge tone="neutral">Pending</Badge>;
    default:           return <Badge>{status}</Badge>;
  }
}

function conductLabel(conduct: string | null): string {
  if (!conduct) return '—';
  return conduct.replace('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

// ── Print builder ─────────────────────────────────────────────────────────────

function buildPrintHtml(
  metadata: NonNullable<ReturnType<typeof useAcademicRegister>['data']>['metadata'],
  subjects: NonNullable<ReturnType<typeof useAcademicRegister>['data']>['subjects'],
  students: AcademicRegisterStudent[],
  schoolName: string
): string {
  const subjectHeaders = subjects
    .map((s) => `<th class="subject-col">${s.subjectName}</th>`)
    .join('');

  const rows = students
    .map((s, idx) => {
      const subjectCells = subjects.map((sub) => {
        const r = s.subjectResults.find((sr) => sr.subjectId === sub.subjectId);
        const val = r?.finalResult !== null && r?.finalResult !== undefined
          ? r.finalResult.toFixed(2)
          : '—';
        const cls = r && !r.isFinalized ? 'pending-cell' : '';
        return `<td class="${cls}">${val}</td>`;
      }).join('');

      const statusCls = s.academicStatus === 'PASS' ? 'pass' : s.academicStatus === 'FAIL' ? 'fail' : 'pending';

      return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="mono small">${s.admissionNumber}</td>
          <td class="bold">${s.studentName}</td>
          <td class="center">${s.gender === 'M' ? 'M' : 'F'}</td>
          <td class="center">${s.age}</td>
          ${subjectCells}
          <td class="center mono">${s.totalObtained !== null ? `${s.totalObtained}/${s.totalPossible}` : '—'}</td>
          <td class="center mono">${s.average !== null ? s.average.toFixed(2) : '—'}</td>
          <td class="center">${s.sectionRank !== null ? `${s.sectionRank}/${s.totalStudentsInSection}` : '—'}</td>
          <td class="center">${s.gradeRank !== null ? `${s.gradeRank}/${s.totalStudentsInGrade}` : '—'}</td>
          <td class="center small">${conductLabel(s.conduct)}</td>
          <td class="center ${statusCls}">${s.academicStatus}</td>
        </tr>`;
    })
    .join('');

  const draftWarning = metadata.isOfficialView
    ? ''
    : `<div class="draft-banner">⚠ DRAFT — This register is not yet finalized and does not represent official results.</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Academic Register — ${metadata.classroomLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; font-size: 9pt; color: #111; padding: 16px; }
    .draft-banner { background: #fef3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; font-weight: bold; font-size: 9pt; color: #856404; }
    .header { margin-bottom: 12px; }
    .school-name { font-size: 14pt; font-weight: bold; text-align: center; margin-bottom: 2px; }
    .register-title { font-size: 11pt; font-weight: bold; text-align: center; margin-bottom: 8px; }
    .meta-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 4px 16px; margin-bottom: 12px; }
    .meta-item { font-size: 8.5pt; }
    .meta-item span { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; font-size: 8pt; }
    th { background: #1a2e1a; color: #fff; padding: 4px 3px; text-align: center; font-size: 7.5pt; white-space: nowrap; border: 1px solid #333; }
    td { border: 1px solid #ccc; padding: 3px 3px; vertical-align: middle; }
    .subject-col { min-width: 48px; }
    .center { text-align: center; }
    .bold { font-weight: 600; }
    .mono { font-family: monospace; font-size: 7.5pt; }
    .small { font-size: 7.5pt; }
    .pass { color: #155724; font-weight: bold; }
    .fail { color: #721c24; font-weight: bold; }
    .pending { color: #856404; }
    .pending-cell { color: #999; font-style: italic; }
    tr:nth-child(even) { background: #f8f8f8; }
    .footer { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .signature-box { border-top: 1px solid #333; padding-top: 4px; text-align: center; font-size: 8pt; }
    .summary-row { margin-top: 12px; font-size: 8.5pt; display: flex; gap: 24px; }
    .summary-item span { font-weight: bold; }
    @media print {
      body { padding: 8px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  ${draftWarning}
  <div class="header">
    <div class="school-name">${schoolName}</div>
    <div class="register-title">Class Academic Register</div>
    <div class="meta-grid">
      <div class="meta-item">Grade/Class: <span>${metadata.classroomLabel}</span></div>
      <div class="meta-item">Academic Year: <span>${metadata.academicYear}</span></div>
      <div class="meta-item">Period: <span>${viewModeLabel(metadata.viewMode)}</span></div>
      <div class="meta-item">Generated: <span>${new Date(metadata.generatedAt).toLocaleDateString()}</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Adm. No.</th>
        <th>Full Name</th>
        <th>Sex</th>
        <th>Age</th>
        ${subjectHeaders}
        <th>Total</th>
        <th>Average</th>
        <th>Sec. Rank</th>
        <th>Grade Rank</th>
        <th>Conduct</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="summary-row">
    <div class="summary-item">Total Students: <span>${metadata.totalStudents}</span></div>
    <div class="summary-item">Pass: <span>${metadata.passCount}</span></div>
    <div class="summary-item">Fail: <span>${metadata.failCount}</span></div>
    <div class="summary-item">Incomplete: <span>${metadata.incompleteCount}</span></div>
    ${metadata.classAverage !== null ? `<div class="summary-item">Class Average: <span>${metadata.classAverage.toFixed(2)}</span></div>` : ''}
  </div>

  <div class="footer">
    <div class="signature-box">Class Teacher Signature</div>
    <div class="signature-box">Vice Director Signature</div>
    <div class="signature-box">Director Signature</div>
  </div>
</body>
</html>`;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AcademicRegisterPage() {
  const { data: classroomsData } = useClassroomOptions();
  const [classroomId, setClassroomId]     = useState<number>(0);
  const [academicYear, setAcademicYear]   = useState(currentAcademicYear());
  const [viewMode, setViewMode]           = useState<RegisterViewMode>('SEMESTER_1');
  const [exportError, setExportError]     = useState<string | null>(null);
  const [isExporting, setIsExporting]     = useState(false);

  const query: AcademicRegisterQuery | null =
    classroomId > 0 && academicYear
      ? { classroomId, academicYear, viewMode }
      : null;

  const { data, isLoading, error, refetch } = useAcademicRegister(query);

  // ── Export ──────────────────────────────────────────────────────────────────
  async function handleExport(format: 'csv' | 'excel') {
    if (!query) return;
    setExportError(null);
    setIsExporting(true);
    try {
      const blob = await academicRegisterApi.exportRegister({ ...query, format });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `register-${data?.metadata.classroomLabel.replace(/\s/g, '_')}-${viewMode}-${academicYear}.csv`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  // ── Print ───────────────────────────────────────────────────────────────────
  function handlePrint() {
    if (!data) return;
    const html = buildPrintHtml(data.metadata, data.subjects, data.students, 'Dinsho Secondary School');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  }

  return (
    <div className="max-w-full">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl">Academic Register</h1>
        {data && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handlePrint}>
              <MdPrint className="h-4 w-4" /> Print
            </Button>
            <Button variant="secondary" onClick={() => void handleExport('csv')} isLoading={isExporting}>
              <MdDownload className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        )}
      </div>
      <LedgerRule />

      {/* ── Filters ── */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <SelectField
          label="Classroom"
          className="min-w-[240px]"
          value={classroomId || ''}
          onChange={(e) => setClassroomId(Number(e.target.value) || 0)}
        >
          <option value="">Select a classroom…</option>
          {classroomsData?.items.map((c) => (
            <option key={c.classroomId} value={c.classroomId}>
              {c.className} {c.section} ({c.academicYear})
            </option>
          ))}
        </SelectField>

        <TextField
          label="Academic year"
          className="min-w-[140px]"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          placeholder="e.g. 2026/27"
        />

        <SelectField
          label="Period"
          className="min-w-[160px]"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as RegisterViewMode)}
        >
          <option value="SEMESTER_1">Semester 1</option>
          <option value="SEMESTER_2">Semester 2</option>
          <option value="FULL_YEAR">Full Year</option>
        </SelectField>
      </div>

      {exportError && <ErrorMessage error={new Error(exportError)} className="mb-4" />}

      {/* ── Empty state ── */}
      {!query && (
        <EmptyState
          title="Select a classroom to begin"
          description="Choose a classroom, academic year, and period to generate the register."
        />
      )}

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-4">
          <p className="font-semibold text-danger-700">Failed to load register</p>
          <p className="mt-0.5 text-sm text-danger-600">
            {error instanceof Error ? error.message : 'An unexpected error occurred.'}
          </p>
          <Button variant="ghost" className="mt-2" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center gap-2 py-12 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700" />
          Generating register…
        </div>
      )}

      {/* ── Register ── */}
      {data && (
        <>
          {/* Draft warning */}
          {!data.metadata.isOfficialView && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3">
              <MdWarningAmber className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
              <p className="text-sm text-gold-700">
                <strong>Draft view — not official.</strong> This register has not been fully finalized.
                Results marked <em>Pending</em> or <em>Incomplete</em> are not yet confirmed.
              </p>
            </div>
          )}

          {/* Official badge */}
          {data.metadata.isOfficialView && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-pine-200 bg-pine-50 px-4 py-2.5">
              <MdCheckCircle className="h-4 w-4 text-pine-700" />
              <p className="text-sm font-semibold text-pine-800">
                Official finalized register
                {data.metadata.finalizedAt && ` — finalized on ${new Date(data.metadata.finalizedAt).toLocaleDateString()}`}
              </p>
            </div>
          )}

          {/* Metadata summary */}
          <div className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4 lg:grid-cols-8">
            {[
              { label: 'Total', value: data.metadata.totalStudents },
              { label: 'Pass', value: data.metadata.passCount, color: 'text-pine-700 font-semibold' },
              { label: 'Fail', value: data.metadata.failCount, color: 'text-danger-600 font-semibold' },
              { label: 'Incomplete', value: data.metadata.incompleteCount, color: 'text-gold-600 font-semibold' },
              { label: 'Pending', value: data.metadata.pendingCount, color: 'text-slate-500' },
              { label: 'Class Avg', value: data.metadata.classAverage !== null ? `${data.metadata.classAverage.toFixed(2)}` : '—' },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className={`text-lg font-bold text-ink-900 ${(item as any).color ?? ''}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Register table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="register-th w-8">#</th>
                  <th className="register-th whitespace-nowrap">Adm. No.</th>
                  <th className="register-th text-left min-w-[140px]">Full Name</th>
                  <th className="register-th w-8">Sex</th>
                  <th className="register-th w-8">Age</th>
                  {data.subjects.map((s) => (
                    <th key={s.subjectId} className="register-th min-w-[64px]">
                      {s.subjectName}
                    </th>
                  ))}
                  <th className="register-th whitespace-nowrap">Total</th>
                  <th className="register-th">Average</th>
                  <th className="register-th whitespace-nowrap">Sec. Rank</th>
                  <th className="register-th whitespace-nowrap">Grade Rank</th>
                  <th className="register-th">Conduct</th>
                  <th className="register-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((student, idx) => (
                  <tr
                    key={student.studentId}
                    className="border-b border-paper-100 last:border-b-0 hover:bg-paper-50"
                  >
                    <td className="register-td text-center text-slate-400">{idx + 1}</td>
                    <td className="register-td font-mono text-slate-500">{student.admissionNumber}</td>
                    <td className="register-td font-medium text-ink-900">{student.studentName}</td>
                    <td className="register-td text-center">{student.gender}</td>
                    <td className="register-td text-center">{student.age}</td>
                    {data.subjects.map((sub) => {
                      const r = student.subjectResults.find((sr) => sr.subjectId === sub.subjectId);
                      const val = r?.finalResult !== null && r?.finalResult !== undefined
                        ? r.finalResult.toFixed(2)
                        : '—';
                      const isUnfinalized = r && !r.isFinalized;
                      return (
                        <td
                          key={sub.subjectId}
                          className={`register-td text-center font-mono ${isUnfinalized ? 'text-gold-600 italic' : ''}`}
                          title={isUnfinalized ? 'Not yet finalized' : undefined}
                        >
                          {val}
                        </td>
                      );
                    })}
                    <td className="register-td text-center font-mono font-semibold">
                      {student.totalObtained !== null && student.totalPossible !== null
                        ? `${student.totalObtained}/${student.totalPossible}`
                        : '—'}
                    </td>
                    <td className="register-td text-center font-mono">
                      {student.average !== null ? student.average.toFixed(2) : '—'}
                    </td>
                    <td className="register-td text-center font-mono">
                      {student.sectionRank !== null
                        ? `${student.sectionRank}/${student.totalStudentsInSection}`
                        : '—'}
                    </td>
                    <td className="register-td text-center font-mono">
                      {student.gradeRank !== null
                        ? `${student.gradeRank}/${student.totalStudentsInGrade}`
                        : '—'}
                    </td>
                    <td className="register-td text-center">
                      {conductLabel(student.conduct)}
                    </td>
                    <td className="register-td text-center">
                      {statusBadge(student.academicStatus)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Unfinalized indicator legend */}
          {data.students.some((s) => s.hasUnfinalizedSubjects) && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-gold-600">
              <MdInfoOutline className="h-3.5 w-3.5" />
              Italicized subject results are not yet finalized.
            </p>
          )}
        </>
      )}
    </div>
  );
}
