import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdPrint,
  MdDownload,
  MdWarningAmber,
  MdCheckCircle,
  MdInfoOutline,
  MdErrorOutline,
  MdTableRows,
  MdGridView,
  MdLock,
  MdLockOpen,
} from 'react-icons/md';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { useConfiguredGrades } from '../../hooks/useGradeSubjectConfig';
import { useAcademicRegister, useGradeRegister } from '../../hooks/useAcademicRegister';
import { useClassroomFinalization, useFinalizeClassroom } from '../../hooks/useFinalization';
import { academicRegisterApi } from '../../lib/academic-register-api';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import type {
  AcademicRegisterQuery,
  AcademicRegisterStudent,
  GradeRegisterQuery,
  RegisterViewMode,
} from '../../types/academic-register';

// ── Constants ─────────────────────────────────────────────────────────────────

const GRADE_OPTIONS = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

type RegisterType = 'section' | 'grade';

// ── Helpers ───────────────────────────────────────────────────────────────────

function viewModeLabel(mode: RegisterViewMode): string {
  switch (mode) {
    case 'SEMESTER_1': return 'Semester 1';
    case 'SEMESTER_2': return 'Semester 2';
    case 'FULL_YEAR':  return 'Full Year';
  }
}

// Semester string for finalization API (FULL_YEAR → not directly supported;
// we use SEMESTER_2 as the "final" semester for full-year finalization checks)
function toFinalizationSemester(mode: RegisterViewMode): 'SEMESTER_1' | 'SEMESTER_2' {
  if (mode === 'SEMESTER_2' || mode === 'FULL_YEAR') return 'SEMESTER_2';
  return 'SEMESTER_1';
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
  return conduct.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

// ── Print builder ─────────────────────────────────────────────────────────────

function buildPrintHtml(
  metadata: NonNullable<ReturnType<typeof useAcademicRegister>['data']>['metadata'],
  subjects: NonNullable<ReturnType<typeof useAcademicRegister>['data']>['subjects'],
  students: AcademicRegisterStudent[]
): string {
  const subjectHeaders = subjects.map((s) => `<th class="subject-col">${s.subjectName}</th>`).join('');
  const rows = students.map((s, idx) => {
    const cells = subjects.map((sub) => {
      const r = s.subjectResults.find((sr) => sr.subjectId === sub.subjectId);
      const val = r?.finalResult != null ? r.finalResult.toFixed(2) : '—';
      return `<td class="${r && !r.isFinalized ? 'pending-cell' : ''}">${val}</td>`;
    }).join('');
    const stCls = s.academicStatus === 'PASS' ? 'pass' : s.academicStatus === 'FAIL' ? 'fail' : 'pending';
    return `<tr>
      <td class="center">${idx + 1}</td>
      <td class="mono small">${s.admissionNumber}</td>
      <td class="bold">${s.studentName}</td>
      <td class="center">${s.gender}</td>
      <td class="center">${s.age}</td>
      ${cells}
      <td class="center mono">${s.totalObtained != null ? `${s.totalObtained}/${s.totalPossible}` : '—'}</td>
      <td class="center mono">${s.average != null ? s.average.toFixed(2) : '—'}</td>
      <td class="center">${s.sectionRank != null ? `${s.sectionRank}/${s.totalStudentsInSection}` : '—'}</td>
      <td class="center">${s.gradeRank != null ? `${s.gradeRank}/${s.totalStudentsInGrade}` : '—'}</td>
      <td class="center small">${conductLabel(s.conduct)}</td>
      <td class="center ${stCls}">${s.academicStatus}</td>
    </tr>`;
  }).join('');

  const draftBanner = metadata.isOfficialView ? '' :
    `<div class="draft-banner">⚠ DRAFT — Not yet finalized. Does not represent official results.</div>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>Academic Register — ${metadata.classroomLabel}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:9pt;color:#111;padding:16px}
    .draft-banner{background:#fef3cd;border:1px solid #ffc107;border-radius:4px;padding:6px 10px;margin-bottom:12px;font-weight:bold;color:#856404}
    .school-name{font-size:14pt;font-weight:bold;text-align:center;margin-bottom:2px}
    .register-title{font-size:11pt;font-weight:bold;text-align:center;margin-bottom:8px}
    .meta-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px 16px;margin-bottom:12px}
    .meta-item{font-size:8.5pt} .meta-item span{font-weight:bold}
    table{width:100%;border-collapse:collapse;font-size:8pt}
    th{background:#1a2e1a;color:#fff;padding:4px 3px;text-align:center;font-size:7.5pt;white-space:nowrap;border:1px solid #333}
    td{border:1px solid #ccc;padding:3px;vertical-align:middle}
    .subject-col{min-width:48px} .center{text-align:center} .bold{font-weight:600}
    .mono{font-family:monospace;font-size:7.5pt} .small{font-size:7.5pt}
    .pass{color:#155724;font-weight:bold} .fail{color:#721c24;font-weight:bold}
    .pending{color:#856404} .pending-cell{color:#999;font-style:italic}
    tr:nth-child(even){background:#f8f8f8}
    .summary-row{margin-top:12px;font-size:8.5pt;display:flex;gap:24px}
    .summary-item span{font-weight:bold}
    .footer{margin-top:24px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
    .sig{border-top:1px solid #333;padding-top:4px;text-align:center;font-size:8pt}
  </style></head><body>
  ${draftBanner}
  <div class="school-name">Dinsho Secondary School</div>
  <div class="register-title">Class Academic Register</div>
  <div class="meta-grid">
    <div class="meta-item">Grade/Class: <span>${metadata.classroomLabel}</span></div>
    <div class="meta-item">Academic Year: <span>${metadata.academicYear}</span></div>
    <div class="meta-item">Period: <span>${viewModeLabel(metadata.viewMode)}</span></div>
    <div class="meta-item">Generated: <span>${new Date(metadata.generatedAt).toLocaleDateString()}</span></div>
  </div>
  <table><thead><tr>
    <th>#</th><th>Adm. No.</th><th>Full Name</th><th>Sex</th><th>Age</th>
    ${subjectHeaders}
    <th>Total</th><th>Average</th><th>Sec.Rank</th><th>Grade Rank</th><th>Conduct</th><th>Status</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <div class="summary-row">
    <div class="summary-item">Total: <span>${metadata.totalStudents}</span></div>
    <div class="summary-item">Pass: <span>${metadata.passCount}</span></div>
    <div class="summary-item">Fail: <span>${metadata.failCount}</span></div>
    <div class="summary-item">Incomplete: <span>${metadata.incompleteCount}</span></div>
    ${metadata.classAverage != null ? `<div class="summary-item">Avg: <span>${metadata.classAverage.toFixed(2)}</span></div>` : ''}
  </div>
  <div class="footer">
    <div class="sig">Class Teacher Signature</div>
    <div class="sig">Vice Director Signature</div>
    <div class="sig">Director Signature</div>
  </div>
</body></html>`;
}

// ── Section Summary Panel ─────────────────────────────────────────────────────

interface SummaryPanelProps {
  metadata: NonNullable<ReturnType<typeof useAcademicRegister>['data']>['metadata'];
  subjectCount: number;
  incompleteStudents: AcademicRegisterStudent[];
  finalizationStatus: string | null;
  finalizedAt: string | null;
  onFinalizeClick: () => void;
  isFinalizing: boolean;
  userRole: string;
}

function SummaryPanel({
  metadata,
  subjectCount,
  incompleteStudents,
  finalizationStatus,
  finalizedAt,
  onFinalizeClick,
  isFinalizing,
  userRole,
}: SummaryPanelProps) {
  const [showIncomplete, setShowIncomplete] = useState(false);
  const canFinalize = ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(userRole);

  const registerStatusLabel = () => {
    if (finalizationStatus === 'FINALIZED') return { label: 'Finalized', tone: 'positive' as const, icon: MdLock };
    if (metadata.pendingCount === 0 && metadata.incompleteCount === 0 && metadata.totalStudents > 0) {
      return { label: 'Ready for finalization', tone: 'positive' as const, icon: MdLockOpen };
    }
    if (metadata.incompleteCount > 0) return { label: 'Incomplete results', tone: 'warning' as const, icon: MdWarningAmber };
    return { label: 'Pending', tone: 'neutral' as const, icon: MdInfoOutline };
  };

  const regStatus = registerStatusLabel();
  const RegIcon = regStatus.icon;

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-0.5">Register Summary</p>
          <p className="font-semibold text-ink-900">
            {metadata.grade} — Section {metadata.section} &nbsp;·&nbsp;
            <span className="text-slate-500 font-normal">{metadata.academicYear} · {viewModeLabel(metadata.viewMode)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RegIcon className={`h-4 w-4 ${regStatus.tone === 'positive' ? 'text-pine-700' : regStatus.tone === 'warning' ? 'text-gold-600' : 'text-slate-400'}`} />
          <Badge tone={regStatus.tone}>{regStatus.label}</Badge>
          {finalizationStatus === 'FINALIZED' && finalizedAt && (
            <span className="text-xs text-slate-500">on {new Date(finalizedAt).toLocaleDateString()}</span>
          )}
          {finalizationStatus !== 'FINALIZED' &&
            regStatus.label === 'Ready for finalization' &&
            canFinalize && (
              <Button onClick={onFinalizeClick} isLoading={isFinalizing} className="text-xs py-1.5 px-3">
                <MdLock className="h-3.5 w-3.5" /> Finalize
              </Button>
            )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: 'Students',        value: metadata.totalStudents,  color: '' },
          { label: 'Req. Subjects',   value: subjectCount,             color: '' },
          { label: 'Pass',            value: metadata.passCount,       color: 'text-pine-700' },
          { label: 'Fail',            value: metadata.failCount,       color: 'text-danger-600' },
          { label: 'Incomplete',      value: metadata.incompleteCount, color: 'text-gold-600' },
          { label: 'Pending',         value: metadata.pendingCount,    color: 'text-slate-500' },
          { label: 'Class Average',   value: metadata.classAverage != null ? `${metadata.classAverage.toFixed(2)}` : '—', color: '' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white px-4 py-3">
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-400">{stat.label}</p>
            <p className={`text-xl font-bold text-ink-900 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Incomplete callout */}
      {incompleteStudents.length > 0 && (
        <div className="border-t border-gold-100 bg-gold-50 px-5 py-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setShowIncomplete((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <MdWarningAmber className="h-4 w-4 shrink-0 text-gold-600" />
              <span className="text-sm font-semibold text-gold-700">
                {incompleteStudents.length} student{incompleteStudents.length > 1 ? 's' : ''} with incomplete results
              </span>
            </div>
            <span className="text-xs text-gold-600">{showIncomplete ? 'Hide ▲' : 'Show ▼'}</span>
          </button>
          {showIncomplete && (
            <ul className="mt-2 flex flex-col gap-1 pl-6">
              {incompleteStudents.map((s) => {
                const missing = s.subjectResults.filter((r) => r.finalResult === null).length;
                return (
                  <li key={s.studentId} className="text-sm text-gold-800">
                    <span className="font-medium">{s.studentName}</span>
                    <span className="text-gold-600"> — {missing} subject{missing > 1 ? 's' : ''} missing result</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Grade-wide summary panel ──────────────────────────────────────────────────

function GradeSummaryPanel({ data }: { data: ReturnType<typeof useGradeRegister>['data'] }) {
  if (!data) return null;
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-0.5">Grade-Wide Overview</p>
        <p className="font-semibold text-ink-900">
          {data.grade} &nbsp;·&nbsp;
          <span className="text-slate-500 font-normal">{data.academicYear} · {viewModeLabel(data.viewMode)}</span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
        {[
          { label: 'Sections',       value: data.totalSections  },
          { label: 'Total Students', value: data.totalStudents  },
          { label: 'Overall Average', value: data.overallAverage != null ? data.overallAverage.toFixed(2) : '—' },
          { label: 'Pass Rate',       value: data.overallPassRate != null ? `${data.overallPassRate.toFixed(1)}%` : '—' },
        ].map((s) => (
          <div key={s.label} className="bg-white px-4 py-3">
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className="text-xl font-bold text-ink-900">{s.value}</p>
          </div>
        ))}
      </div>
      {/* Section breakdown table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-paper-100 text-left text-xs uppercase tracking-wide text-ink-700">
              <th className="px-5 py-2">Section</th>
              <th className="px-5 py-2 text-right">Students</th>
              <th className="px-5 py-2 text-right">Pass</th>
              <th className="px-5 py-2 text-right">Fail</th>
              <th className="px-5 py-2 text-right">Average</th>
            </tr>
          </thead>
          <tbody>
            {data.sections.map((sec) => (
              <tr key={sec.classroomId} className="border-t border-slate-100 hover:bg-paper-50">
                <td className="px-5 py-2 font-medium">{sec.section}</td>
                <td className="px-5 py-2 text-right font-mono">{sec.studentCount}</td>
                <td className="px-5 py-2 text-right font-mono text-pine-700">{sec.passCount}</td>
                <td className="px-5 py-2 text-right font-mono text-danger-600">{sec.failCount}</td>
                <td className="px-5 py-2 text-right font-mono">{sec.sectionAverage != null ? sec.sectionAverage.toFixed(2) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AcademicRegisterPage() {
  const navigate = useNavigate();

  // ── Filter state ────────────────────────────────────────────────────────────
  const [grade, setGrade]             = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [classroomId, setClassroomId]   = useState<number>(0);
  const [viewMode, setViewMode]         = useState<RegisterViewMode>('SEMESTER_1');
  const [registerType, setRegisterType] = useState<RegisterType>('section');

  // ── UI state ────────────────────────────────────────────────────────────────
  const [exportError, setExportError]     = useState<string | null>(null);
  const [isExporting, setIsExporting]     = useState(false);
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  // ── Data: classrooms for cascade filter ────────────────────────────────────
  const { data: allClassrooms } = useClassroomOptions();
  const { data: configuredGrades } = useConfiguredGrades();

  // Derive available academic years from classrooms
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    allClassrooms?.items.forEach((c) => years.add(c.academicYear));
    return Array.from(years).sort().reverse();
  }, [allClassrooms]);

  // Classrooms filtered to selected grade + year
  const filteredClassrooms = useMemo(() => {
    if (!grade || !academicYear) return [];
    return (allClassrooms?.items ?? []).filter(
      (c) => c.className === grade && c.academicYear === academicYear
    );
  }, [allClassrooms, grade, academicYear]);

  // Is this grade/year configured in GradeSubjectConfig?
  const isGradeConfigured = useMemo(() => {
    if (!grade || !academicYear) return true; // don't show warning until both selected
    return (configuredGrades ?? []).some(
      (g) => g.className === grade && g.academicYear === academicYear
    );
  }, [configuredGrades, grade, academicYear]);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const sectionQuery: AcademicRegisterQuery | null =
    registerType === 'section' && classroomId > 0 && academicYear
      ? { classroomId, academicYear, viewMode }
      : null;

  const gradeQuery: GradeRegisterQuery | null =
    registerType === 'grade' && grade && academicYear
      ? { grade, academicYear, viewMode }
      : null;

  const { data: sectionData, isLoading: sectionLoading, error: sectionError, refetch: sectionRefetch } =
    useAcademicRegister(sectionQuery);

  const { data: gradeData, isLoading: gradeLoading, error: gradeError, refetch: gradeRefetch } =
    useGradeRegister(gradeQuery);

  // Finalization status (section view only)
  const finSemester = toFinalizationSemester(viewMode);
  const { data: finalization, refetch: refetchFinalization } = useClassroomFinalization(
    classroomId > 0 && registerType === 'section' ? classroomId : 0,
    finSemester,
    academicYear
  );
  const finalizeClassroom = useFinalizeClassroom();

  // ── Derived ─────────────────────────────────────────────────────────────────
  const incompleteStudents = useMemo(
    () => (sectionData?.students ?? []).filter((s) => s.academicStatus === 'INCOMPLETE'),
    [sectionData]
  );

  const isLoading = sectionLoading || gradeLoading;
  const error     = sectionError || gradeError;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleExport(format: 'csv' | 'excel') {
    if (!sectionQuery) return;
    setExportError(null);
    setIsExporting(true);
    try {
      const blob = await academicRegisterApi.exportRegister({ ...sectionQuery, format });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `register-${sectionData?.metadata.classroomLabel.replace(/\s/g, '_')}-${viewMode}-${academicYear}.csv`;
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

  function handlePrint() {
    if (!sectionData) return;
    const html = buildPrintHtml(sectionData.metadata, sectionData.subjects, sectionData.students);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  async function handleFinalize() {
    if (!classroomId || !academicYear) return;
    setFinalizeError(null);
    try {
      await finalizeClassroom.mutateAsync({ classroomId, semester: finSemester, academicYear });
      setFinalizeConfirmOpen(false);
      await Promise.all([sectionRefetch(), refetchFinalization()]);
    } catch (err) {
      setFinalizeError(err instanceof Error ? err.message : 'Finalization failed.');
      setFinalizeConfirmOpen(false);
    }
  }

  function handleGradeChange(newGrade: string) {
    setGrade(newGrade);
    setClassroomId(0); // reset section when grade changes
  }

  function handleYearChange(newYear: string) {
    setAcademicYear(newYear);
    setClassroomId(0);
  }

  const canShowRegister =
    (registerType === 'section' && sectionQuery !== null) ||
    (registerType === 'grade' && gradeQuery !== null);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-full">
      {/* ── Page header ── */}
      <div className="mb-1 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl">Academic Register</h1>
        {sectionData && registerType === 'section' && (
          <div className="flex gap-2 flex-wrap">
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

      {/* ── Filter card ── */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Select Register
        </p>

        {/* Register type toggle */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setRegisterType('section')}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              registerType === 'section'
                ? 'border-pine-700 bg-pine-700 text-white'
                : 'border-slate-200 text-slate-600 hover:border-pine-700/40 hover:text-pine-900'
            }`}
          >
            <MdTableRows className="h-4 w-4" />
            Section Register
          </button>
          <button
            type="button"
            onClick={() => setRegisterType('grade')}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              registerType === 'grade'
                ? 'border-pine-700 bg-pine-700 text-white'
                : 'border-slate-200 text-slate-600 hover:border-pine-700/40 hover:text-pine-900'
            }`}
          >
            <MdGridView className="h-4 w-4" />
            Grade-Wide
          </button>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Grade */}
          <SelectField
            label="Grade"
            className="min-w-[160px]"
            value={grade}
            onChange={(e) => handleGradeChange(e.target.value)}
          >
            <option value="">Select grade…</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </SelectField>

          {/* Academic Year — derived from existing classrooms */}
          <SelectField
            label="Academic Year"
            className="min-w-[160px]"
            value={academicYear}
            onChange={(e) => handleYearChange(e.target.value)}
          >
            <option value="">Select year…</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </SelectField>

          {/* Section — only for section register */}
          {registerType === 'section' && (
            <SelectField
              label="Section"
              className="min-w-[160px]"
              value={classroomId || ''}
              onChange={(e) => setClassroomId(Number(e.target.value) || 0)}
              disabled={!grade || !academicYear}
            >
              <option value="">
                {!grade || !academicYear
                  ? 'Select grade & year first…'
                  : filteredClassrooms.length === 0
                  ? 'No sections found for this grade/year'
                  : 'Select section…'}
              </option>
              {filteredClassrooms.map((c) => (
                <option key={c.classroomId} value={c.classroomId}>
                  {c.section}{c.homeroomTeacher ? ` — ${c.homeroomTeacher.firstName} ${c.homeroomTeacher.lastName}` : ''}
                </option>
              ))}
            </SelectField>
          )}

          {/* Period */}
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

        {/* Grade not configured warning */}
        {grade && academicYear && !isGradeConfigured && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2.5">
            <MdWarningAmber className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
            <p className="text-sm text-gold-700">
              No required subjects have been configured for <strong>{grade}</strong> in <strong>{academicYear}</strong>.
              The register cannot be generated without subject configuration.{' '}
              <button
                type="button"
                className="font-semibold underline hover:no-underline"
                onClick={() => navigate('/grade-subject-config')}
              >
                Configure Grade Subjects
              </button>
            </p>
          </div>
        )}
      </div>

      {exportError  && <ErrorMessage error={new Error(exportError)}  className="mb-4" />}
      {finalizeError && <ErrorMessage error={new Error(finalizeError)} className="mb-4" />}

      {/* ── Empty state ── */}
      {!canShowRegister && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-14 text-center">
          <p className="font-semibold text-slate-600">No register selected</p>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            Select a grade, academic year
            {registerType === 'section' ? ', and section' : ''} to generate the academic register.
            Required subjects are determined by Grade Subject Configuration.
          </p>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center gap-2 py-12 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700" />
          Generating register…
        </div>
      )}

      {/* ── Error ── */}
      {error && !isLoading && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-4">
          <div className="flex items-start gap-2">
            <MdErrorOutline className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
            <div>
              <p className="font-semibold text-danger-700">Failed to load register</p>
              <p className="mt-0.5 text-sm text-danger-600">
                {error instanceof Error ? error.message : 'An unexpected error occurred.'}
              </p>
            </div>
          </div>
          <Button variant="ghost" className="mt-2" onClick={() => { void sectionRefetch(); void gradeRefetch(); }}>
            Try again
          </Button>
        </div>
      )}

      {/* ── Grade-wide view ── */}
      {registerType === 'grade' && gradeData && !gradeLoading && (
        <GradeSummaryPanel data={gradeData} />
      )}

      {/* ── Section register ── */}
      {registerType === 'section' && sectionData && !sectionLoading && (
        <>
          {/* Summary panel */}
          <SummaryPanel
            metadata={sectionData.metadata}
            subjectCount={sectionData.subjects.length}
            incompleteStudents={incompleteStudents}
            finalizationStatus={finalization?.status ?? null}
            finalizedAt={finalization?.finalizedAt ?? null}
            onFinalizeClick={() => setFinalizeConfirmOpen(true)}
            isFinalizing={finalizeClassroom.isPending}
            userRole="ADMIN"
          />

          {/* Draft warning */}
          {!sectionData.metadata.isOfficialView && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3">
              <MdWarningAmber className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
              <p className="text-sm text-gold-700">
                <strong>Draft view — not official.</strong>{' '}
                This register has not been fully finalized. Pending and incomplete results are not confirmed.
              </p>
            </div>
          )}

          {/* Official badge */}
          {sectionData.metadata.isOfficialView && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-pine-200 bg-pine-50 px-4 py-2.5">
              <MdCheckCircle className="h-4 w-4 text-pine-700" />
              <p className="text-sm font-semibold text-pine-800">
                Official finalized register
                {sectionData.metadata.finalizedAt &&
                  ` — finalized on ${new Date(sectionData.metadata.finalizedAt).toLocaleDateString()}`}
              </p>
            </div>
          )}

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
                  {sectionData.subjects.map((s) => (
                    <th key={s.subjectId} className="register-th min-w-[60px] max-w-[80px]">
                      <span className="block truncate" title={s.subjectName}>
                        {s.subjectName.length > 8 ? s.subjectName.slice(0, 7) + '.' : s.subjectName}
                      </span>
                    </th>
                  ))}
                  <th className="register-th whitespace-nowrap">Total</th>
                  <th className="register-th">Avg</th>
                  <th className="register-th whitespace-nowrap">Sec.Rank</th>
                  <th className="register-th whitespace-nowrap">Grade Rank</th>
                  <th className="register-th">Conduct</th>
                  <th className="register-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {sectionData.students.map((student, idx) => (
                  <tr
                    key={student.studentId}
                    className={`border-b border-paper-100 last:border-b-0 hover:bg-paper-50 ${
                      student.academicStatus === 'INCOMPLETE' ? 'bg-gold-50/30' : ''
                    }`}
                  >
                    <td className="register-td text-center text-slate-400">{idx + 1}</td>
                    <td className="register-td font-mono text-slate-500">{student.admissionNumber}</td>
                    <td className="register-td font-medium text-ink-900">{student.studentName}</td>
                    <td className="register-td text-center">{student.gender}</td>
                    <td className="register-td text-center">{student.age}</td>
                    {sectionData.subjects.map((sub) => {
                      const r = student.subjectResults.find((sr) => sr.subjectId === sub.subjectId);
                      const val = r?.finalResult != null ? r.finalResult.toFixed(2) : '—';
                      const isUnfinalized = r && !r.isFinalized;
                      const noAssignment = r && !r.hasAssignment;
                      return (
                        <td
                          key={sub.subjectId}
                          className={`register-td text-center font-mono ${
                            noAssignment ? 'text-slate-300' :
                            isUnfinalized ? 'text-gold-600 italic' : ''
                          }`}
                          title={
                            noAssignment ? 'No teacher assigned' :
                            isUnfinalized ? 'Not yet finalized' : undefined
                          }
                        >
                          {val}
                        </td>
                      );
                    })}
                    <td className="register-td text-center font-mono font-semibold">
                      {student.totalObtained != null && student.totalPossible != null
                        ? `${student.totalObtained}/${student.totalPossible}`
                        : '—'}
                    </td>
                    <td className="register-td text-center font-mono">
                      {student.average != null ? student.average.toFixed(2) : '—'}
                    </td>
                    <td className="register-td text-center font-mono">
                      {student.sectionRank != null
                        ? `${student.sectionRank}/${student.totalStudentsInSection}`
                        : '—'}
                    </td>
                    <td className="register-td text-center font-mono">
                      {student.gradeRank != null
                        ? `${student.gradeRank}/${student.totalStudentsInGrade}`
                        : '—'}
                    </td>
                    <td className="register-td text-center">{conductLabel(student.conduct)}</td>
                    <td className="register-td text-center">{statusBadge(student.academicStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            {sectionData.students.some((s) => s.hasUnfinalizedSubjects) && (
              <span className="flex items-center gap-1">
                <span className="italic text-gold-600">82.00</span>
                &nbsp;= not yet finalized
              </span>
            )}
            {sectionData.students.some((s) => s.subjectResults.some((r) => !r.hasAssignment)) && (
              <span className="flex items-center gap-1">
                <span className="text-slate-300">—</span>
                &nbsp;= no teacher assigned
              </span>
            )}
            <span>
              <MdInfoOutline className="inline h-3.5 w-3.5" />
              &nbsp;Ranks exclude students with incomplete or pending results.
            </span>
          </div>
        </>
      )}

      {/* ── Finalize confirm ── */}
      <ConfirmDialog
        isOpen={finalizeConfirmOpen}
        title="Finalize classroom results"
        message={`This will officially finalize the ${viewModeLabel(viewMode)} results for ${
          sectionData?.metadata.classroomLabel ?? ''
        } (${academicYear}). Students and parents will be notified. This action is audited and can only be corrected by an authorized administrator.`}
        confirmLabel="Finalize"
        isDangerous={false}
        isLoading={finalizeClassroom.isPending}
        onConfirm={() => void handleFinalize()}
        onCancel={() => setFinalizeConfirmOpen(false)}
      />
    </div>
  );
}
