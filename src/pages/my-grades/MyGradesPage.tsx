import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMyGrades } from '../../hooks/useGrades';
import { useMyAcademicReports } from '../../hooks/useAcademicReports';
import { academicReportsApi } from '../../lib/academic-reports-api';
import { authApi } from '../../lib/auth-api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import type { GradeCategory, Semester, StudentGradesParams } from '../../types/grade';

// ── helpers ──────────────────────────────────────────────────────────────────

const SEMESTER_LABELS: Record<Semester, string> = {
  SEMESTER_1: 'Semester 1',
  SEMESTER_2: 'Semester 2',
};

const CATEGORY_LABELS: Record<GradeCategory, string> = {
  QUIZ:       'Quiz',
  ASSIGNMENT: 'Assignment',
  TEST:       'Test',
  MID_EXAM:   'Mid Exam',
  FINAL_EXAM: 'Final Exam',
  OTHER:      'Other',
};

// Pill colour for each assessment type — consistent with school theme
const CATEGORY_STYLE: Record<GradeCategory, string> = {
  QUIZ:       'bg-sky-100 text-sky-800',
  ASSIGNMENT: 'bg-violet-100 text-violet-800',
  TEST:       'bg-amber-100 text-amber-800',
  MID_EXAM:   'bg-orange-100 text-orange-800',
  FINAL_EXAM: 'bg-pine-100 text-pine-800',
  OTHER:      'bg-slate-100 text-slate-700',
};

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
        if (prev.academicYear === undefined) {
          return { ...prev, academicYear: enrollmentYear };
        }
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
  const { data: reports,    isLoading: isReportsLoading } = useMyAcademicReports();
  const [downloadingReportId, setDownloadingReportId] = useState<number | null>(null);

  const sortedReports = reports
    ? [...reports].sort(
        (a, b) => b.academicYear.localeCompare(a.academicYear) || b.semester.localeCompare(a.semester)
      )
    : [];

  async function handleDownloadPdf(report: (typeof sortedReports)[number]) {
    setDownloadingReportId(report.reportId);
    try {
      await academicReportsApi.downloadReportCardPdf(report.studentId, report.semester, report.academicYear);
    } finally {
      setDownloadingReportId(null);
    }
  }

  return (
    <div className="max-w-3xl">

      {/* ── Page header ── */}
      <div className="mb-1">
        <h1 className="text-2xl font-semibold text-ink-900">Assessments</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Your assessment marks and report cards. Read-only — contact your teacher if you see an error.
        </p>
      </div>
      <LedgerRule />

      {/* ── Filters ── */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <SelectField
          label="Semester"
          className="min-w-[150px]"
          value={filters.semester ?? ''}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              semester: (e.target.value || undefined) as Semester | undefined,
            }))
          }
        >
          <option value="">All semesters</option>
          <option value="SEMESTER_1">Semester 1</option>
          <option value="SEMESTER_2">Semester 2</option>
        </SelectField>

        <SelectField
          label="Academic Year"
          className="min-w-[150px]"
          value={filters.academicYear ?? ''}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, academicYear: e.target.value || undefined }))
          }
        >
          {availableYears.length > 1 && <option value="">All years</option>}
          {availableYears.map((yr) => (
            <option key={yr} value={yr}>{yr}</option>
          ))}
        </SelectField>
      </div>

      {/* ── Assessment subject cards ── */}
      {isGradesLoading ? (
        <div className="flex items-center gap-2 py-16 text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
          <span className="text-sm">Loading assessments…</span>
        </div>
      ) : !gradesData || gradesData.length === 0 ? (
        <EmptyState
          title="No assessments yet"
          description="No assessment results are available yet. Results become visible after your teacher releases them."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {gradesData.map((subject) => (
            <div
              key={`${subject.teacherSubjectId}-${subject.semester}-${subject.academicYear}`}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              {/* ── Subject header ── */}
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[0.9375rem] font-semibold text-ink-900">
                    {subject.subject.subjectName}
                  </p>
                  <p className="mt-0.5 text-[0.75rem] text-slate-400">
                    {subject.academicYear}
                    {' · '}
                    {SEMESTER_LABELS[subject.semester]}
                    {' · '}
                    {subject.teacher.firstName} {subject.teacher.lastName}
                  </p>
                </div>
              </div>

              {/* ── Assessment rows ── */}
              {subject.components.length === 0 ? (
                <p className="px-4 py-3 text-[0.8125rem] italic text-slate-400">
                  No assessments defined yet.
                </p>
              ) : (
                <>
                  <ul>
                    {subject.components.map((c, idx) => {
                      const isReleased = c.isReleased;
                      const hasScore   = isReleased && c.score !== null;

                      return (
                        <li
                          key={c.gradeComponentId}
                          className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                            idx < subject.components.length - 1
                              ? 'border-b border-slate-100'
                              : ''
                          }`}
                        >
                          {/* Left: type pill + name */}
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${
                                CATEGORY_STYLE[c.category]
                              }`}
                            >
                              {CATEGORY_LABELS[c.category]}
                            </span>
                            <span className="truncate text-[0.875rem] text-ink-800">
                              {c.name}
                            </span>
                          </div>

                          {/* Right: score only */}
                          <div className="shrink-0">
                            {hasScore ? (
                              <span className="font-mono text-[0.9375rem] font-semibold text-ink-900">
                                {c.score}
                                <span className="text-[0.8125rem] font-normal text-slate-400">
                                  /{c.maxMarks}
                                </span>
                              </span>
                            ) : (
                              <span className="font-mono text-[0.875rem] text-slate-300">
                                — /{c.maxMarks}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* ── Subject total footer — released components only ── */}
                  {subject.totalMaxMarks > 0 && (
                    <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5">
                      <span className="text-[0.8125rem] font-semibold text-slate-500 uppercase tracking-wide">
                        Total
                      </span>
                      <span className="font-mono text-[1rem] font-bold text-ink-900">
                        {subject.totalScore}
                        <span className="text-[0.875rem] font-normal text-slate-400">
                          /{subject.totalMaxMarks}
                        </span>
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Report cards ── */}
      <div className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-ink-900">Report Cards</h2>

        {isReportsLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : sortedReports.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
            <EmptyState
              title="No report card yet"
              description="Your school will generate this once grades for the semester are finalized."
            />
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {sortedReports.map((r) => (
              <div
                key={r.reportId}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="text-[0.75rem] text-slate-400">
                    {SEMESTER_LABELS[r.semester as Semester]} · {r.academicYear}
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-pine-900">
                      {r.averageMark}%
                    </span>
                    {r.rank && (
                      <Badge tone="positive">Rank #{r.rank}</Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => void handleDownloadPdf(r)}
                  isLoading={downloadingReportId === r.reportId}
                >
                  Download PDF
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
