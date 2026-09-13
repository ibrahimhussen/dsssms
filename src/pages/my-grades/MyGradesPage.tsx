import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMyGrades } from '../../hooks/useGrades';
import { useMyAcademicReports } from '../../hooks/useAcademicReports';
import { gradesApi } from '../../lib/grades-api';
import { systemSettingsApi } from '../../lib/system-settings-api';
import { buildReportCardHtml } from '../../lib/report-card-html';
import { authApi } from '../../lib/auth-api';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import { MdDownload, MdEmojiEvents, MdBarChart, MdSchool } from 'react-icons/md';
import type { GradeCategory, Semester, StudentGradesParams, SubjectGradeBreakdown } from '../../types/grade';
import type { AcademicReport } from '../../types/academic-report';

// ── constants ─────────────────────────────────────────────────────────────────

const SEMESTER_LABELS: Record<Semester, string> = {
  SEMESTER_1: 'Semester 1',
  SEMESTER_2: 'Semester 2',
};

const CATEGORY_LABELS: Record<GradeCategory, string> = {
  QUIZ: 'Quiz', ASSIGNMENT: 'Assignment', TEST: 'Test',
  MID_EXAM: 'Mid Exam', FINAL_EXAM: 'Final Exam', OTHER: 'Other',
};

const CATEGORY_STYLE: Record<GradeCategory, string> = {
  QUIZ:       'bg-sky-100 text-sky-800',
  ASSIGNMENT: 'bg-violet-100 text-violet-800',
  TEST:       'bg-amber-100 text-amber-800',
  MID_EXAM:   'bg-orange-100 text-orange-800',
  FINAL_EXAM: 'bg-pine-100 text-pine-800',
  OTHER:      'bg-slate-100 text-slate-700',
};

// ── sub-components ────────────────────────────────────────────────────────────

/** Animated percentage bar */
function ScoreBar({ pct, pass }: { pct: number; pass: boolean }) {
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${pass ? 'bg-pine-600' : 'bg-danger-500'}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

/** Single subject card */
function SubjectCard({ subject, idx }: { subject: SubjectGradeBreakdown; idx: number }) {
  const [expanded, setExpanded] = useState(false);
  const pct = subject.totalMaxMarks > 0
    ? Math.round((subject.totalScore / subject.totalMaxMarks) * 1000) / 10
    : 0;
  const pass = pct >= 50;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Subject header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 text-left hover:from-blue-50 transition-colors"
      >
        {/* Rank circle */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine-100 text-pine-800 font-bold text-sm">
          {idx + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink-900 text-[0.9375rem] truncate">
            {subject.subject.subjectName}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {SEMESTER_LABELS[subject.semester]} · {subject.academicYear}
            {subject.teacher && ` · ${subject.teacher.firstName} ${subject.teacher.lastName}`}
          </p>
          <ScoreBar pct={pct} pass={pass} />
        </div>
        {/* Score summary */}
        <div className="shrink-0 text-right">
          <p className={`text-xl font-black ${pass ? 'text-pine-700' : 'text-danger-600'}`}>
            {pct.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {subject.totalScore} / {subject.totalMaxMarks}
          </p>
        </div>
        <span className={`text-slate-400 text-xs ml-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {/* Assessment breakdown */}
      {expanded && (
        <div>
          {subject.components.length === 0 ? (
            <p className="px-5 py-3 text-sm italic text-slate-400">No assessments defined yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2 text-left font-semibold">Assessment</th>
                  <th className="px-4 py-2 text-center font-semibold">Type</th>
                  <th className="px-4 py-2 text-right font-semibold">Score</th>
                  <th className="px-4 py-2 text-right font-semibold">Max</th>
                  <th className="px-4 py-2 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {subject.components.map((c, ci) => {
                  const cPct = c.isReleased && c.score !== null && c.maxMarks > 0
                    ? Math.round((c.score / c.maxMarks) * 1000) / 10
                    : null;
                  return (
                    <tr key={c.gradeComponentId}
                      className={`border-t border-slate-100 ${ci % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                      <td className="px-5 py-2.5 font-medium text-ink-800">{c.name}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${CATEGORY_STYLE[c.category]}`}>
                          {CATEGORY_LABELS[c.category]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {c.isReleased && c.score !== null ? c.score : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">{c.maxMarks}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">
                        {cPct !== null
                          ? <span className={cPct >= 50 ? 'text-pine-700' : 'text-danger-600'}>{cPct.toFixed(1)}%</span>
                          : <span className="text-slate-300 text-xs">Not released</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Subject total row */}
              {subject.totalMaxMarks > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={2} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">Total</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-ink-900">{subject.totalScore}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-500">{subject.totalMaxMarks}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-bold ${pass ? 'text-pine-700' : 'text-danger-600'}`}>
                      {pct.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      )}
    </div>
  );
}

/** Report card tile */
function ReportTile({
  report,
  isLoading,
  onDownload,
}: {
  report: AcademicReport;
  isLoading: boolean;
  onDownload: () => void;
}) {
  const pass = report.averageMark >= 50;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {SEMESTER_LABELS[report.semester as Semester]}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-ink-700">{report.academicYear}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${pass ? 'bg-pine-100 text-pine-800' : 'bg-danger-100 text-danger-700'}`}>
          {pass ? 'PASS' : 'FAIL'}
        </span>
      </div>
      <div className="flex items-end gap-3">
        <div>
          <p className={`text-3xl font-black ${pass ? 'text-pine-800' : 'text-danger-600'}`}>
            {report.averageMark.toFixed(1)}%
          </p>
          {report.rank && (
            <div className="mt-1 flex items-center gap-1 text-amber-600">
              <MdEmojiEvents className="h-4 w-4" />
              <span className="text-xs font-semibold">Rank #{report.rank}</span>
            </div>
          )}
        </div>
      </div>
      {/* Mini bar */}
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${pass ? 'bg-pine-500' : 'bg-danger-400'}`}
          style={{ width: `${Math.min(report.averageMark, 100)}%` }}
        />
      </div>
      <Button variant="ghost" onClick={onDownload} isLoading={isLoading} className="mt-1 w-full">
        <MdDownload className="h-4 w-4" /> Download Report Card
      </Button>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export function MyGradesPage() {
  const { data: profile } = useQuery({
    queryKey: ['auth', 'profile'],
    queryFn:  () => authApi.getProfile(),
    staleTime: 60_000,
  });

  const enrollmentYear = useMemo(() => {
    const rd = profile?.roleData as Record<string, unknown> | null;
    const classroom = rd?.classroom as { academicYear?: string } | null;
    return classroom?.academicYear ?? undefined;
  }, [profile]);

  const [filters, setFilters] = useState<StudentGradesParams>({
    semester:     undefined,
    academicYear: undefined,
  });

  useEffect(() => {
    if (enrollmentYear) {
      setFilters((prev) => {
        if (prev.academicYear === undefined) return { ...prev, academicYear: enrollmentYear };
        return prev;
      });
    }
  }, [enrollmentYear]);

  const { data: allGradesData } = useMyGrades({});
  const availableYears = useMemo(() => {
    const years = new Set<string>((allGradesData ?? []).map((g) => g.academicYear));
    if (enrollmentYear) years.add(enrollmentYear);
    return [...years].sort().reverse();
  }, [allGradesData, enrollmentYear]);

  const { data: gradesData, isLoading: isGradesLoading } = useMyGrades(filters);
  const { data: reports, isLoading: isReportsLoading }   = useMyAcademicReports();
  const [downloadingReportId, setDownloadingReportId]    = useState<number | null>(null);

  const sortedReports = useMemo(() =>
    reports
      ? [...reports].sort((a, b) =>
          b.academicYear.localeCompare(a.academicYear) || b.semester.localeCompare(a.semester)
        )
      : [],
    [reports]
  );

  async function handleDownloadPdf(report: (typeof sortedReports)[number]) {
    setDownloadingReportId(report.reportId);
    try {
      const [subjects, settings] = await Promise.all([
        gradesApi.getMyGrades({ semester: report.semester, academicYear: report.academicYear }),
        systemSettingsApi.get(),
      ]);

      // classroomLabel from profile roleData
      const rd = profile?.roleData as Record<string, unknown> | null;
      const classroom = rd?.classroom as { className?: string; section?: string } | null;
      const classroomLabel = classroom
        ? `${classroom.className ?? ''} ${classroom.section ?? ''}`.trim()
        : '';

      const html = buildReportCardHtml({
        schoolName:      settings.schoolName,
        schoolZone:      settings.schoolZone    ?? null,
        schoolWereda:    settings.schoolWereda  ?? null,
        schoolRegion:    settings.schoolRegion  ?? null,
        schoolLogo:      settings.schoolLogo    ?? null,
        studentName:     report.studentName,
        admissionNumber: (profile?.roleData as any)?.admissionNumber ?? '',
        classroomLabel,
        semester:        report.semester,
        academicYear:    report.academicYear,
        averageMark:     report.averageMark,
        rank:            report.rank,
        subjects,
        isNonOfficial:   true,
      });

      const htmlWithPrint = html.replace(
        '</body></html>',
        `<script>window.onload=function(){setTimeout(function(){window.print();},600);};<\/script></body></html>`
      );
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(htmlWithPrint);
      w.document.close();
      w.focus();
    } finally {
      setDownloadingReportId(null);
    }
  }

  // ── Summary stats from current filtered grades ────────────────────────────
  const summaryStats = useMemo(() => {
    if (!gradesData || gradesData.length === 0) return null;
    const subjects = gradesData.filter((s) => s.totalMaxMarks > 0);
    if (subjects.length === 0) return null;
    const avg = subjects.reduce((sum, s) =>
      sum + (s.totalScore / s.totalMaxMarks) * 100, 0
    ) / subjects.length;
    const best = subjects.reduce((a, b) =>
      (b.totalScore / b.totalMaxMarks) > (a.totalScore / a.totalMaxMarks) ? b : a
    );
    const passed = subjects.filter((s) => (s.totalScore / s.totalMaxMarks) >= 0.5).length;
    return { avg: Math.round(avg * 10) / 10, best, passed, total: subjects.length };
  }, [gradesData]);

  // ── Latest report for hero card ───────────────────────────────────────────
  const latestReport = sortedReports[0] ?? null;

  return (
    <div className="max-w-4xl">
      {/* ── Page header ── */}
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Assessments</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Your marks, subject breakdown and report cards.
          </p>
        </div>
      </div>
      <LedgerRule />

      {/* ── Hero summary cards ── */}
      {(summaryStats || latestReport) && (
        <div className="mb-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Overall average */}
          {summaryStats && (
            <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold uppercase tracking-wide">
                <MdBarChart className="h-3.5 w-3.5" /> Average
              </div>
              <p className={`text-3xl font-black mt-1 ${summaryStats.avg >= 50 ? 'text-pine-700' : 'text-danger-600'}`}>
                {summaryStats.avg}%
              </p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${summaryStats.avg >= 50 ? 'bg-pine-500' : 'bg-danger-400'}`}
                  style={{ width: `${Math.min(summaryStats.avg, 100)}%` }} />
              </div>
            </div>
          )}
          {/* Passed subjects */}
          {summaryStats && (
            <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold uppercase tracking-wide">
                <MdSchool className="h-3.5 w-3.5" /> Subjects
              </div>
              <p className="text-3xl font-black mt-1 text-pine-700">
                {summaryStats.passed}<span className="text-base font-normal text-slate-400">/{summaryStats.total}</span>
              </p>
              <p className="text-xs text-slate-400">passed</p>
            </div>
          )}
          {/* Best subject */}
          {summaryStats && (
            <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold uppercase tracking-wide">
                <MdEmojiEvents className="h-3.5 w-3.5" /> Best Subject
              </div>
              <p className="text-lg font-bold mt-1 text-ink-900 truncate">
                {summaryStats.best.subject.subjectName}
              </p>
              <p className="text-xs text-pine-700 font-semibold">
                {Math.round((summaryStats.best.totalScore / summaryStats.best.totalMaxMarks) * 1000) / 10}%
              </p>
            </div>
          )}
          {/* Latest report card */}
          {latestReport && (
            <div className={`flex flex-col gap-1 rounded-2xl border px-5 py-4 shadow-sm ${
              latestReport.averageMark >= 50
                ? 'border-pine-200 bg-pine-50'
                : 'border-danger-200 bg-danger-50'
            }`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Last Report
              </div>
              <p className={`text-3xl font-black mt-1 ${latestReport.averageMark >= 50 ? 'text-pine-700' : 'text-danger-600'}`}>
                {latestReport.averageMark.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500">
                {SEMESTER_LABELS[latestReport.semester as Semester]} · {latestReport.academicYear}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <SelectField label="Semester" className="min-w-[150px]"
          value={filters.semester ?? ''}
          onChange={(e) => setFilters((p) => ({ ...p, semester: (e.target.value || undefined) as Semester | undefined }))}>
          <option value="">All semesters</option>
          <option value="SEMESTER_1">Semester 1</option>
          <option value="SEMESTER_2">Semester 2</option>
        </SelectField>
        <SelectField label="Academic Year" className="min-w-[150px]"
          value={filters.academicYear ?? ''}
          onChange={(e) => setFilters((p) => ({ ...p, academicYear: e.target.value || undefined }))}>
          {availableYears.length > 1 && <option value="">All years</option>}
          {availableYears.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
        </SelectField>
      </div>

      {/* ── Subject cards ── */}
      {isGradesLoading ? (
        <div className="flex items-center gap-2 py-16 text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
          <span className="text-sm">Loading assessments…</span>
        </div>
      ) : !gradesData || gradesData.length === 0 ? (
        <EmptyState
          title="No assessments yet"
          description="Results become visible once your teacher releases them."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {gradesData.map((subject, idx) => (
            <SubjectCard
              key={`${subject.teacherSubjectId}-${subject.semester}-${subject.academicYear}`}
              subject={subject}
              idx={idx}
            />
          ))}
        </div>
      )}

      {/* ── Report cards ── */}
      <div className="mt-10">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-semibold text-ink-900">Report Cards</h2>
          {sortedReports.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {sortedReports.length}
            </span>
          )}
        </div>

        {isReportsLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : sortedReports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 shadow-sm">
            <EmptyState
              title="No report card yet"
              description="Your school will generate this once grades for the semester are finalized."
            />
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {sortedReports.map((r) => (
              <ReportTile
                key={r.reportId}
                report={r}
                isLoading={downloadingReportId === r.reportId}
                onDownload={() => void handleDownloadPdf(r)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
