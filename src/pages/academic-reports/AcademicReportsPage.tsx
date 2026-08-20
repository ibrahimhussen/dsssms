import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { academicRegisterApi } from '../../lib/academic-register-api';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import type { AcademicStatus, RegisterViewMode } from '../../types/academic-register';

// ── helpers ───────────────────────────────────────────────────────────────────

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

function statusTone(status: AcademicStatus): 'positive' | 'danger' | 'warning' | 'neutral' {
  if (status === 'PASS')       return 'positive';
  if (status === 'FAIL')       return 'danger';
  if (status === 'INCOMPLETE') return 'warning';
  return 'neutral'; // PENDING
}

function statusLabel(status: AcademicStatus): string {
  if (status === 'PASS')       return 'Pass';
  if (status === 'FAIL')       return 'Fail';
  if (status === 'INCOMPLETE') return 'Incomplete';
  return 'Pending';
}

function semesterLabel(viewMode: RegisterViewMode): string {
  if (viewMode === 'SEMESTER_1') return 'Semester 1';
  if (viewMode === 'SEMESTER_2') return 'Semester 2';
  return 'Full Year';
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  const textColor =
    tone === 'positive' ? 'text-pine-700'
    : tone === 'danger'   ? 'text-danger-600'
    : tone === 'warning'  ? 'text-gold-600'
    : 'text-ink-900';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export function AcademicReportsPage() {
  const { data: classroomsData } = useClassroomOptions();

  // ── filter state ─────────────────────────────────────────────────────────
  const [academicYear, setAcademicYear] = useState<string>(currentAcademicYear());
  const [viewMode,     setViewMode]     = useState<RegisterViewMode>('SEMESTER_1');
  const [grade,        setGrade]        = useState<string>('');
  // '' = All Classrooms; numeric string = specific classroomId
  const [classroomSel, setClassroomSel] = useState<string>('');

  // ── committed query (only updated when Director presses Generate) ─────────
  const [committed, setCommitted] = useState<{
    academicYear: string;
    viewMode:     RegisterViewMode;
    grade:        string;
    classroomId:  number | null;
  } | null>(null);

  // ── derived values from classrooms list ──────────────────────────────────
  const allClassrooms = classroomsData?.items ?? [];

  const gradeOptions = useMemo(
    () => [...new Set(allClassrooms.map((c) => c.className))].sort(),
    [allClassrooms]
  );

  const classroomsForGrade = useMemo(
    () =>
      allClassrooms.filter(
        (c) => c.className === grade && c.academicYear === academicYear
      ),
    [allClassrooms, grade, academicYear]
  );

  // ── data queries (only fire when committed is non-null) ───────────────────
  const singleEnabled = Boolean(committed && committed.classroomId !== null);
  const gradeEnabled  = Boolean(committed && committed.classroomId === null && committed.grade);

  const {
    data:    singleData,
    isLoading: singleLoading,
    error:   singleError,
  } = useQuery({
    queryKey: ['academic-reports-page', 'classroom', committed],
    queryFn:  () =>
      academicRegisterApi.getRegister({
        classroomId:  committed!.classroomId!,
        academicYear: committed!.academicYear,
        viewMode:     committed!.viewMode,
      }),
    enabled: singleEnabled,
    staleTime: 30_000,
  });

  const {
    data:    gradeData,
    isLoading: gradeLoading,
    error:   gradeError,
  } = useQuery({
    queryKey: ['academic-reports-page', 'grade', committed],
    queryFn:  () =>
      academicRegisterApi.getGradeRegister({
        grade:        committed!.grade,
        academicYear: committed!.academicYear,
        viewMode:     committed!.viewMode,
      }),
    enabled: gradeEnabled,
    staleTime: 30_000,
  });

  const isLoading = singleLoading || gradeLoading;
  const queryError = singleError ?? gradeError;

  // ── handlers ──────────────────────────────────────────────────────────────
  function handleGenerate() {
    if (!grade) return;
    setCommitted({
      academicYear,
      viewMode,
      grade,
      classroomId: classroomSel ? Number(classroomSel) : null,
    });
  }

  // Reset classroom selection when grade or year changes
  function handleGradeChange(g: string) {
    setGrade(g);
    setClassroomSel('');
    setCommitted(null);
  }

  function handleYearChange(y: string) {
    setAcademicYear(y);
    setClassroomSel('');
    setCommitted(null);
  }

  // ── convenience derivations for the single-classroom view ────────────────
  const meta     = singleData?.metadata;
  const students = singleData?.students ?? [];

  // Sort students: ranked first (by sectionRank asc), unranked last
  const sortedStudents = useMemo(
    () =>
      [...students].sort((a, b) => {
        if (a.sectionRank !== null && b.sectionRank !== null)
          return a.sectionRank - b.sectionRank;
        if (a.sectionRank !== null) return -1;
        if (b.sectionRank !== null) return 1;
        return a.studentName.localeCompare(b.studentName);
      }),
    [students]
  );

  const canGenerate = Boolean(grade);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-full">
      <div className="mb-1">
        <h1 className="text-2xl">Academic Reports</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          View academic performance and student ranking. Results reflect the existing
          finalization workflow — no editing is possible here.
        </p>
      </div>
      <LedgerRule />

      {/* ── Filters ── */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
          Report Filters
        </p>
        <div className="flex flex-wrap items-end gap-3">

          {/* 1. Academic Year */}
          <SelectField
            label="Academic Year"
            className="min-w-[160px]"
            value={academicYear}
            onChange={(e) => handleYearChange(e.target.value)}
          >
            {ACADEMIC_YEAR_OPTIONS.map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </SelectField>

          {/* 2. Semester */}
          <SelectField
            label="Semester"
            className="min-w-[180px]"
            value={viewMode}
            onChange={(e) => {
              setViewMode(e.target.value as RegisterViewMode);
              setCommitted(null);
            }}
          >
            <option value="SEMESTER_1">Semester 1</option>
            <option value="SEMESTER_2">Semester 2</option>
            <option value="FULL_YEAR">Full Year</option>
          </SelectField>

          {/* 3. Grade */}
          <SelectField
            label="Grade"
            className="min-w-[160px]"
            value={grade}
            onChange={(e) => handleGradeChange(e.target.value)}
          >
            <option value="">Select grade…</option>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </SelectField>

          {/* 4. Classroom */}
          <SelectField
            label="Classroom"
            className="min-w-[200px]"
            value={classroomSel}
            onChange={(e) => {
              setClassroomSel(e.target.value);
              setCommitted(null);
            }}
            disabled={!grade}
          >
            <option value="">All Classrooms</option>
            {classroomsForGrade.map((c) => (
              // Label is "Grade 9 C" — no year appended
              <option key={c.classroomId} value={c.classroomId}>
                {c.className} {c.section}
              </option>
            ))}
          </SelectField>

          {/* Generate */}
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            isLoading={isLoading}
          >
            Generate Report
          </Button>
        </div>
      </div>

      {/* ── Error ── */}
      {queryError && (
        <div className="mb-5 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
          <p className="text-sm text-danger-700">
            {queryError instanceof Error ? queryError.message : 'Could not load report.'}
          </p>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center gap-2 py-12 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700" />
          Loading report…
        </div>
      )}

      {/* ── No committed query yet ── */}
      {!committed && !isLoading && (
        <EmptyState
          title="No report generated"
          description="Select an academic year, semester, grade, and optionally a classroom, then click Generate Report."
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SINGLE-CLASSROOM VIEW
          ═══════════════════════════════════════════════════════════════════ */}
      {!isLoading && committed?.classroomId !== null && singleData && meta && (
        <>
          {/* Report header */}
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-ink-900">
                {meta.classroomLabel} — {semesterLabel(meta.viewMode)}
              </h2>
              <p className="text-sm text-slate-500">
                Academic Year: {meta.academicYear}
                {meta.isOfficialView
                  ? ' · Official (Finalized)'
                  : ' · Preview (not fully finalized)'}
              </p>
            </div>
            {!meta.isOfficialView && (
              <Badge tone="warning">Preview — results not yet finalized</Badge>
            )}
          </div>

          {/* ── Academic Summary ── */}
          <section className="mb-7">
            <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
              Academic Summary
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <StatCard label="Total Students"       value={meta.totalStudents} />
              <StatCard label="With Results"
                value={meta.passCount + meta.failCount + meta.incompleteCount} />
              <StatCard label="Passed"   value={meta.passCount}      tone="positive" />
              <StatCard label="Failed"   value={meta.failCount}      tone="danger" />
              <StatCard label="Incomplete" value={meta.incompleteCount} tone="warning" />
              <StatCard label="Pending"  value={meta.pendingCount}   tone="neutral" />
              <StatCard
                label="Average Mark"
                value={meta.classAverage !== null ? `${meta.classAverage.toFixed(1)}%` : '—'}
              />
            </div>
          </section>

          {/* ── Student Performance ── */}
          <section>
            <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
              Student Performance
            </p>

            {sortedStudents.length === 0 ? (
              <EmptyState
                title="No students found"
                description="This classroom has no students enrolled for the selected period."
              />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[700px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3 w-14">Rank</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Student ID</th>
                      <th className="px-4 py-3">Classroom</th>
                      <th className="px-4 py-3 text-right">Average Mark</th>
                      <th className="px-4 py-3">Academic Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map((s, idx) => (
                      <tr
                        key={s.studentId}
                        className={`border-b border-slate-100 last:border-0 transition-colors hover:bg-paper-50 ${
                          idx % 2 === 1 ? 'bg-slate-50/40' : ''
                        }`}
                      >
                        {/* Rank */}
                        <td className="px-4 py-3 text-center">
                          {s.sectionRank !== null ? (
                            <span
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                s.sectionRank === 1
                                  ? 'bg-gold-100 text-gold-700'
                                  : s.sectionRank === 2
                                  ? 'bg-slate-200 text-slate-700'
                                  : s.sectionRank === 3
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-paper-100 text-ink-700'
                              }`}
                            >
                              {s.sectionRank}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Student name */}
                        <td className="px-4 py-3 font-medium text-ink-900">{s.studentName}</td>

                        {/* Admission number */}
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {s.admissionNumber}
                        </td>

                        {/* Classroom label */}
                        <td className="px-4 py-3 text-slate-600">{meta.classroomLabel}</td>

                        {/* Average */}
                        <td className="px-4 py-3 text-right font-semibold text-ink-900">
                          {s.average !== null ? `${s.average.toFixed(1)}%` : '—'}
                        </td>

                        {/* Academic status */}
                        <td className="px-4 py-3">
                          <Badge tone={statusTone(s.academicStatus)}>
                            {statusLabel(s.academicStatus)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          GRADE-WIDE (ALL CLASSROOMS) VIEW
          ═══════════════════════════════════════════════════════════════════ */}
      {!isLoading && committed?.classroomId === null && gradeData && (
        <>
          {/* Report header */}
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-ink-900">
                {gradeData.grade} — {semesterLabel(gradeData.viewMode)}
              </h2>
              <p className="text-sm text-slate-500">
                Academic Year: {gradeData.academicYear} ·{' '}
                {gradeData.totalSections} section{gradeData.totalSections !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* ── School / Grade Summary ── */}
          <section className="mb-7">
            <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
              Grade Summary
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total Students"   value={gradeData.totalStudents} />
              <StatCard label="Total Sections"   value={gradeData.totalSections} />
              <StatCard
                label="Overall Average"
                value={gradeData.overallAverage !== null ? `${gradeData.overallAverage.toFixed(1)}%` : '—'}
              />
              <StatCard
                label="Pass Rate"
                value={gradeData.overallPassRate !== null ? `${gradeData.overallPassRate.toFixed(1)}%` : '—'}
                tone={
                  gradeData.overallPassRate !== null
                    ? gradeData.overallPassRate >= 70
                      ? 'positive'
                      : gradeData.overallPassRate >= 50
                      ? 'warning'
                      : 'danger'
                    : undefined
                }
              />
            </div>
          </section>

          {/* ── Classroom Performance Table ── */}
          <section>
            <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
              Classroom Performance
            </p>
            {gradeData.sections.length === 0 ? (
              <EmptyState
                title="No classrooms found"
                description="No classrooms are configured for this grade and academic year."
              />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[600px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-3">Classroom</th>
                      <th className="px-5 py-3 text-right">Students</th>
                      <th className="px-5 py-3 text-right">Average Mark</th>
                      <th className="px-5 py-3 text-right">Passed</th>
                      <th className="px-5 py-3 text-right">Failed</th>
                      <th className="px-5 py-3 text-right">Pass Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradeData.sections.map((sec, idx) => {
                      const passRate =
                        sec.studentCount > 0
                          ? Math.round((sec.passCount / sec.studentCount) * 1000) / 10
                          : null;
                      return (
                        <tr
                          key={sec.classroomId}
                          className={`border-b border-slate-100 last:border-0 transition-colors hover:bg-paper-50 ${
                            idx % 2 === 1 ? 'bg-slate-50/40' : ''
                          }`}
                        >
                          <td className="px-5 py-3 font-semibold text-ink-900">
                            {gradeData.grade} {sec.section}
                          </td>
                          <td className="px-5 py-3 text-right text-slate-700">
                            {sec.studentCount}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-ink-900">
                            {sec.sectionAverage !== null
                              ? `${sec.sectionAverage.toFixed(1)}%`
                              : '—'}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="font-medium text-pine-700">{sec.passCount}</span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="font-medium text-danger-600">{sec.failCount}</span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            {passRate !== null ? (
                              <Badge
                                tone={
                                  passRate >= 70
                                    ? 'positive'
                                    : passRate >= 50
                                    ? 'warning'
                                    : 'danger'
                                }
                              >
                                {passRate.toFixed(1)}%
                              </Badge>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
