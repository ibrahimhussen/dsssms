import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdAutoAwesome, MdBarChart, MdCheckCircle, MdWarningAmber, MdInfoOutline } from 'react-icons/md';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { useGenerateClassroomReports } from '../../hooks/useAcademicReports';
import { academicRegisterApi } from '../../lib/academic-register-api';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { AcademicReport, GenerateReportsResult } from '../../types/academic-report';
import type { AcademicStatus, RegisterViewMode } from '../../types/academic-register';
import type { Semester } from '../../types/grade';

// ── helpers ──────────────────────────────────────────────────────────────────

function currentAcademicYear(): string {
  const y = new Date().getFullYear();
  return `${y}/${String(y + 1).slice(2)}`;
}

const ACADEMIC_YEAR_OPTIONS: string[] = (() => {
  const base = new Date().getFullYear();
  return [-1, 0, 1].map((offset) => {
    const y = base + offset;
    return `${y}/${String(y + 1).slice(2)}`;
  });
})();

const SEMESTER_LABELS: Record<Semester, string> = {
  SEMESTER_1: 'Semester 1',
  SEMESTER_2: 'Semester 2',
};

function semesterLabel(viewMode: RegisterViewMode | Semester): string {
  if (viewMode === 'SEMESTER_1') return 'Semester 1';
  if (viewMode === 'SEMESTER_2') return 'Semester 2';
  return 'Full Year';
}

function statusTone(status: AcademicStatus): 'positive' | 'danger' | 'warning' | 'neutral' {
  if (status === 'PASS')       return 'positive';
  if (status === 'FAIL')       return 'danger';
  if (status === 'INCOMPLETE') return 'warning';
  return 'neutral';
}

function statusLabel(status: AcademicStatus): string {
  if (status === 'PASS')       return 'Pass';
  if (status === 'FAIL')       return 'Fail';
  if (status === 'INCOMPLETE') return 'Incomplete';
  return 'Pending';
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  const textColor =
    tone === 'positive' ? 'text-pine-700'
    : tone === 'danger'   ? 'text-danger-600'
    : tone === 'warning'  ? 'text-gold-600'
    : 'text-ink-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
}

// ── Tab: Generate Reports ─────────────────────────────────────────────────────

function GenerateReportsTab() {
  const { data: classroomsData } = useClassroomOptions();
  const generateMutation = useGenerateClassroomReports();

  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [semester,     setSemester]     = useState<Semester>('SEMESTER_1');
  const [classroomId,  setClassroomId]  = useState<string>('');
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [lastResult,   setLastResult]   = useState<GenerateReportsResult | null>(null);

  const allClassrooms = classroomsData?.items ?? [];

  // Build grade options from classrooms
  const gradeOptions = useMemo(
    () => [...new Set(allClassrooms.map((c) => c.className))].sort(),
    [allClassrooms]
  );

  const [grade, setGrade] = useState('');

  const filteredClassrooms = useMemo(
    () => allClassrooms.filter(
      (c) => c.className === grade && c.academicYear === academicYear
    ),
    [allClassrooms, grade, academicYear]
  );

  const selectedClassroom = allClassrooms.find((c) => String(c.classroomId) === classroomId);
  const canGenerate = Boolean(classroomId && semester && academicYear);

  async function handleConfirmGenerate() {
    if (!classroomId) return;
    setConfirmOpen(false);
    try {
      const result = await generateMutation.mutateAsync({
        classroomId: Number(classroomId),
        semester,
        academicYear,
      });
      setLastResult(result);
    } catch {
      // error shown via mutation.error
    }
  }

  // Sort generated reports by rank
  const sortedReports = useMemo(
    () => lastResult
      ? [...lastResult.generated].sort(
          (a, b) => (a.rank ?? 9999) - (b.rank ?? 9999)
        )
      : [],
    [lastResult]
  );

  return (
    <div>
      {/* Workflow explanation banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-pine-200 bg-pine-50 px-4 py-3.5">
        <MdInfoOutline className="mt-0.5 h-4 w-4 shrink-0 text-pine-700" />
        <div className="text-sm text-pine-800">
          <strong>Workflow:</strong> Select a classroom, semester, and academic year, then click{' '}
          <strong>Generate Report</strong>. The system calculates each student's average from their
          entered marks and assigns class rankings. After reviewing the preview, the report becomes
          available on the <strong>Student Transcript</strong> page automatically.
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
          Report Criteria
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Academic Year"
            className="min-w-[150px]"
            value={academicYear}
            onChange={(e) => {
              setAcademicYear(e.target.value);
              setClassroomId('');
              setLastResult(null);
            }}
          >
            {ACADEMIC_YEAR_OPTIONS.map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </SelectField>

          <SelectField
            label="Semester"
            className="min-w-[160px]"
            value={semester}
            onChange={(e) => { setSemester(e.target.value as Semester); setLastResult(null); }}
          >
            <option value="SEMESTER_1">Semester 1</option>
            <option value="SEMESTER_2">Semester 2</option>
          </SelectField>

          <SelectField
            label="Grade"
            className="min-w-[150px]"
            value={grade}
            onChange={(e) => { setGrade(e.target.value); setClassroomId(''); setLastResult(null); }}
          >
            <option value="">Select grade…</option>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </SelectField>

          <SelectField
            label="Classroom"
            className="min-w-[190px]"
            value={classroomId}
            onChange={(e) => { setClassroomId(e.target.value); setLastResult(null); }}
            disabled={!grade}
          >
            <option value="">Select classroom…</option>
            {filteredClassrooms.map((c) => (
              <option key={c.classroomId} value={c.classroomId}>
                {c.className} {c.section}
              </option>
            ))}
          </SelectField>

          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!canGenerate}
            isLoading={generateMutation.isPending}
          >
            Generate Report
          </Button>
        </div>
      </div>

      {/* Error */}
      {generateMutation.error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
          <MdWarningAmber className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
          <p className="text-sm text-danger-700">
            {generateMutation.error instanceof Error
              ? generateMutation.error.message
              : 'Could not generate reports.'}
          </p>
        </div>
      )}

      {/* Initial empty state */}
      {!lastResult && !generateMutation.isPending && !generateMutation.error && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pine-50">
            <MdAutoAwesome className="h-6 w-6 text-pine-700" />
          </div>
          <p className="font-semibold text-ink-900">Select a classroom to generate its report</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Choose an academic year, semester, grade, and classroom above, then click Generate Report.
          </p>
        </div>
      )}

      {/* Loading */}
      {generateMutation.isPending && (
        <div className="flex items-center gap-2 py-12 text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
          <span className="text-sm">Calculating student averages and rankings…</span>
        </div>
      )}

      {/* Generated report preview */}
      {lastResult && (
        <>
          {/* Success / skipped notice */}
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-pine-200 bg-pine-50 px-4 py-3">
            <MdCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-pine-700" />
            <div className="text-sm text-pine-800">
              <strong>Report generated successfully.</strong>{' '}
              {lastResult.generated.length} student{lastResult.generated.length !== 1 ? 's' : ''} processed
              {lastResult.skippedStudentIds.length > 0 && (
                <>, {lastResult.skippedStudentIds.length} student{lastResult.skippedStudentIds.length !== 1 ? 's' : ''} skipped (no grades entered)</>
              )}.
              {' '}This report is now available on each student's Transcript page.
            </div>
          </div>

          {/* Context */}
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-ink-900">
                {selectedClassroom
                  ? `${selectedClassroom.className} ${selectedClassroom.section}`
                  : 'Classroom'}{' '}
                — {SEMESTER_LABELS[semester]}
              </h2>
              <p className="text-sm text-slate-500">Academic Year: {academicYear}</p>
            </div>
            <Badge tone="positive">Report Generated</Badge>
          </div>

          {/* Summary stats derived from generated data */}
          {(() => {
            const passThreshold = 50; // standard pass mark
            const passed = lastResult.generated.filter((r) => r.averageMark >= passThreshold).length;
            const failed  = lastResult.generated.filter((r) => r.averageMark < passThreshold).length;
            const avg = lastResult.generated.length > 0
              ? Math.round(
                  (lastResult.generated.reduce((s, r) => s + r.averageMark, 0) /
                    lastResult.generated.length) * 10
                ) / 10
              : null;
            return (
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatCard label="Total Students"  value={lastResult.generated.length + lastResult.skippedStudentIds.length} />
                <StatCard label="With Results"    value={lastResult.generated.length} />
                <StatCard label="Passed"          value={passed}  tone="positive" />
                <StatCard label="Below Average"   value={failed}  tone="danger" />
                <StatCard label="Average Mark"    value={avg !== null ? `${avg}%` : '—'} />
              </div>
            );
          })()}

          {/* Student ranking table */}
          <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
            Student Rankings
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="w-14 px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3 text-right">Average Mark</th>
                  <th className="px-4 py-3 text-right">Result</th>
                </tr>
              </thead>
              <tbody>
                {sortedReports.map((r, idx) => {
                  const passed = r.averageMark >= 50;
                  return (
                    <tr
                      key={r.reportId}
                      className={`border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/60 ${
                        idx % 2 === 1 ? 'bg-slate-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 text-center">
                        {r.rank !== null ? (
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              r.rank === 1 ? 'bg-amber-100 text-amber-800'
                              : r.rank === 2 ? 'bg-slate-200 text-slate-700'
                              : r.rank === 3 ? 'bg-orange-100 text-orange-700'
                              : 'bg-paper-100 text-ink-700'
                            }`}
                          >
                            {r.rank}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-ink-900">{r.studentName}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-ink-900">
                        {r.averageMark.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          passed
                            ? 'bg-pine-100 text-pine-800'
                            : 'bg-danger-100 text-danger-700'
                        }`}>
                          {passed ? 'Pass' : 'Below Average'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {lastResult.skippedStudentIds.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              {lastResult.skippedStudentIds.length} student{lastResult.skippedStudentIds.length !== 1 ? 's were' : ' was'} skipped
              — no grade components have been entered for them yet.
            </p>
          )}
        </>
      )}

      {/* Confirmation dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Generate academic report?"
        message={
          selectedClassroom
            ? `This will calculate and save the average mark and class ranking for every student in ${selectedClassroom.className} ${selectedClassroom.section} for ${SEMESTER_LABELS[semester]} ${academicYear}.\n\nThe generated report will immediately become visible on each student's Transcript page. You can regenerate the report at any time if marks are updated.`
            : 'Generate academic report for the selected classroom?'
        }
        confirmLabel="Generate Report"
        isLoading={generateMutation.isPending}
        onConfirm={() => void handleConfirmGenerate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

// ── Tab: View Academic Register ───────────────────────────────────────────────

function ViewReportsTab() {
  const { data: classroomsData } = useClassroomOptions();

  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [viewMode,     setViewMode]     = useState<RegisterViewMode>('SEMESTER_1');
  const [grade,        setGrade]        = useState('');
  const [classroomSel, setClassroomSel] = useState('');

  const [committed, setCommitted] = useState<{
    academicYear: string;
    viewMode:     RegisterViewMode;
    grade:        string;
    classroomId:  number | null;
  } | null>(null);

  const allClassrooms = classroomsData?.items ?? [];

  const gradeOptions = useMemo(
    () => [...new Set(allClassrooms.map((c) => c.className))].sort(),
    [allClassrooms]
  );

  const classroomsForGrade = useMemo(
    () => allClassrooms.filter((c) => c.className === grade && c.academicYear === academicYear),
    [allClassrooms, grade, academicYear]
  );

  const singleEnabled = Boolean(committed && committed.classroomId !== null);
  const gradeEnabled  = Boolean(committed && committed.classroomId === null && committed.grade);

  const { data: singleData, isLoading: singleLoading, error: singleError } = useQuery({
    queryKey: ['academic-reports-page', 'classroom', committed],
    queryFn:  () => academicRegisterApi.getRegister({
      classroomId:  committed!.classroomId!,
      academicYear: committed!.academicYear,
      viewMode:     committed!.viewMode,
    }),
    enabled: singleEnabled,
    staleTime: 30_000,
  });

  const { data: gradeData, isLoading: gradeLoading, error: gradeError } = useQuery({
    queryKey: ['academic-reports-page', 'grade', committed],
    queryFn:  () => academicRegisterApi.getGradeRegister({
      grade:        committed!.grade,
      academicYear: committed!.academicYear,
      viewMode:     committed!.viewMode,
    }),
    enabled: gradeEnabled,
    staleTime: 30_000,
  });

  const isLoading  = singleLoading || gradeLoading;
  const queryError = singleError ?? gradeError;

  const meta     = singleData?.metadata;
  const students = singleData?.students ?? [];

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => {
      if (a.sectionRank !== null && b.sectionRank !== null) return a.sectionRank - b.sectionRank;
      if (a.sectionRank !== null) return -1;
      if (b.sectionRank !== null) return 1;
      return a.studentName.localeCompare(b.studentName);
    }),
    [students]
  );

  function handleGenerate() {
    if (!grade) return;
    setCommitted({
      academicYear,
      viewMode,
      grade,
      classroomId: classroomSel ? Number(classroomSel) : null,
    });
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
          Report Filters
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <SelectField label="Academic Year" className="min-w-[150px]" value={academicYear}
            onChange={(e) => { setAcademicYear(e.target.value); setClassroomSel(''); setCommitted(null); }}>
            {ACADEMIC_YEAR_OPTIONS.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
          </SelectField>

          <SelectField label="Semester" className="min-w-[160px]" value={viewMode}
            onChange={(e) => { setViewMode(e.target.value as RegisterViewMode); setCommitted(null); }}>
            <option value="SEMESTER_1">Semester 1</option>
            <option value="SEMESTER_2">Semester 2</option>
            <option value="FULL_YEAR">Full Year</option>
          </SelectField>

          <SelectField label="Grade" className="min-w-[150px]" value={grade}
            onChange={(e) => { setGrade(e.target.value); setClassroomSel(''); setCommitted(null); }}>
            <option value="">Select grade…</option>
            {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </SelectField>

          <SelectField label="Classroom" className="min-w-[190px]" value={classroomSel}
            onChange={(e) => { setClassroomSel(e.target.value); setCommitted(null); }}
            disabled={!grade}>
            <option value="">All Classrooms</option>
            {classroomsForGrade.map((c) => (
              <option key={c.classroomId} value={c.classroomId}>
                {c.className} {c.section}
              </option>
            ))}
          </SelectField>

          <Button onClick={handleGenerate} disabled={!grade} isLoading={isLoading}>
            View Report
          </Button>
        </div>
      </div>

      {queryError && (
        <div className="mb-5 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
          <p className="text-sm text-danger-700">
            {queryError instanceof Error ? queryError.message : 'Could not load report.'}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-12 text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
          <span className="text-sm">Loading report…</span>
        </div>
      )}

      {!committed && !isLoading && (
        <EmptyState title="Select filters above" description="Choose a grade and click View Report to see academic results." />
      )}

      {/* Single classroom view */}
      {!isLoading && committed?.classroomId !== null && singleData && meta && (
        <>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-ink-900">
                {meta.classroomLabel} — {semesterLabel(meta.viewMode)}
              </h2>
              <p className="text-sm text-slate-500">
                Academic Year: {meta.academicYear}
                {meta.isOfficialView ? ' · Finalized' : ' · Preview'}
              </p>
            </div>
            <Badge tone={meta.isOfficialView ? 'positive' : 'warning'}>
              {meta.isOfficialView ? 'Finalized' : 'Preview — not yet finalized'}
            </Badge>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <StatCard label="Total"       value={meta.totalStudents} />
            <StatCard label="With Results" value={meta.passCount + meta.failCount + meta.incompleteCount} />
            <StatCard label="Passed"       value={meta.passCount}      tone="positive" />
            <StatCard label="Failed"       value={meta.failCount}      tone="danger" />
            <StatCard label="Incomplete"   value={meta.incompleteCount} tone="warning" />
            <StatCard label="Pending"      value={meta.pendingCount} />
            <StatCard label="Average"      value={meta.classAverage !== null ? `${meta.classAverage.toFixed(1)}%` : '—'} />
          </div>

          <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
            Student Performance
          </p>
          {sortedStudents.length === 0 ? (
            <EmptyState title="No students found" description="No students enrolled for this period." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[700px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="w-14 px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Student ID</th>
                    <th className="px-4 py-3">Classroom</th>
                    <th className="px-4 py-3 text-right">Average</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Failed Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((s, idx) => (
                    <tr key={s.studentId}
                      className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${idx % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                      <td className="px-4 py-2.5 text-center">
                        {s.sectionRank !== null ? (
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            s.sectionRank === 1 ? 'bg-amber-100 text-amber-800'
                            : s.sectionRank === 2 ? 'bg-slate-200 text-slate-700'
                            : s.sectionRank === 3 ? 'bg-orange-100 text-orange-700'
                            : 'bg-paper-100 text-ink-700'
                          }`}>{s.sectionRank}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-ink-900">{s.studentName}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{s.admissionNumber}</td>
                      <td className="px-4 py-2.5 text-slate-600">{meta.classroomLabel}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {s.average !== null ? `${s.average.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={statusTone(s.academicStatus)}>{statusLabel(s.academicStatus)}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {s.failedSubjects.length === 0
                          ? <span className="text-slate-300">—</span>
                          : <span className="text-danger-600 font-medium">{s.failedSubjects.join(', ')}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Grade-wide view */}
      {!isLoading && committed?.classroomId === null && gradeData && (
        <>
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-ink-900">
              {gradeData.grade} — {semesterLabel(gradeData.viewMode)}
            </h2>
            <p className="text-sm text-slate-500">
              Academic Year: {gradeData.academicYear} · {gradeData.totalSections} section{gradeData.totalSections !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Students"  value={gradeData.totalStudents} />
            <StatCard label="Total Sections"  value={gradeData.totalSections} />
            <StatCard label="Overall Average" value={gradeData.overallAverage !== null ? `${gradeData.overallAverage.toFixed(1)}%` : '—'} />
            <StatCard label="Pass Rate"       value={gradeData.overallPassRate !== null ? `${gradeData.overallPassRate.toFixed(1)}%` : '—'}
              tone={gradeData.overallPassRate !== null ? gradeData.overallPassRate >= 70 ? 'positive' : gradeData.overallPassRate >= 50 ? 'warning' : 'danger' : undefined} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[500px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Classroom</th>
                  <th className="px-5 py-3 text-right">Students</th>
                  <th className="px-5 py-3 text-right">Average</th>
                  <th className="px-5 py-3 text-right">Passed</th>
                  <th className="px-5 py-3 text-right">Failed</th>
                  <th className="px-5 py-3 text-right">Pass Rate</th>
                </tr>
              </thead>
              <tbody>
                {gradeData.sections.map((sec, idx) => {
                  const pr = sec.studentCount > 0
                    ? Math.round((sec.passCount / sec.studentCount) * 1000) / 10
                    : null;
                  return (
                    <tr key={sec.classroomId}
                      className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${idx % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                      <td className="px-5 py-2.5 font-semibold text-ink-900">
                        {gradeData.grade} {sec.section}
                      </td>
                      <td className="px-5 py-2.5 text-right">{sec.studentCount}</td>
                      <td className="px-5 py-2.5 text-right font-semibold">
                        {sec.sectionAverage !== null ? `${sec.sectionAverage.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium text-pine-700">{sec.passCount}</td>
                      <td className="px-5 py-2.5 text-right font-medium text-danger-600">{sec.failCount}</td>
                      <td className="px-5 py-2.5 text-right">
                        {pr !== null ? (
                          <Badge tone={pr >= 70 ? 'positive' : pr >= 50 ? 'warning' : 'danger'}>
                            {pr.toFixed(1)}%
                          </Badge>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AcademicReportsPage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'view'>('generate');

  return (
    <div className="max-w-full">
      <div className="mb-1">
        <h1 className="text-2xl font-semibold text-ink-900">Academic Reports</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Generate and review academic reports. Generated reports become available on student transcripts.
        </p>
      </div>
      <LedgerRule />

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {([
          { id: 'generate' as const, label: 'Generate Reports', icon: MdAutoAwesome },
          { id: 'view'     as const, label: 'View Academic Register', icon: MdBarChart },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === id
                ? 'border-pine-700 text-pine-800'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'generate' ? <GenerateReportsTab /> : <ViewReportsTab />}
    </div>
  );
}
