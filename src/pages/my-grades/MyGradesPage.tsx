import { useState } from 'react';
import { useMyGrades } from '../../hooks/useGrades';
import { useMyAcademicReports } from '../../hooks/useAcademicReports';
import { academicReportsApi } from '../../lib/academic-reports-api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import type { SubjectGradeBreakdown, Semester, StudentGradesParams } from '../../types/grade';

const SEMESTER_LABELS: Record<Semester, string> = {
  SEMESTER_1: 'Semester 1',
  SEMESTER_2: 'Semester 2',
};

export function MyGradesPage() {
  const [filters, setFilters] = useState<StudentGradesParams>({
    semester: undefined,
    academicYear: undefined,
  });

  const { data: gradesData, isLoading: isGradesLoading } = useMyGrades(filters);
  const { data: reports, isLoading: isReportsLoading } = useMyAcademicReports();
  const [downloadingReportId, setDownloadingReportId] = useState<number | null>(null);

  const sortedReports = reports
    ? [...reports].sort(
        (a, b) =>
          b.academicYear.localeCompare(a.academicYear) ||
          b.semester.localeCompare(a.semester)
      )
    : [];

  async function handleDownloadPdf(report: (typeof sortedReports)[number]) {
    setDownloadingReportId(report.reportId);
    try {
      await academicReportsApi.downloadReportCardPdf(
        report.studentId,
        report.semester,
        report.academicYear
      );
    } finally {
      setDownloadingReportId(null);
    }
  }

  const columns: Column<SubjectGradeBreakdown>[] = [
    {
      header: 'Subject',
      render: (g) => `${g.subject.subjectName} (${g.subject.subjectCode})`,
    },
    {
      header: 'Score',
      render: (g) => `${g.totalScore} / ${g.totalMaxMarks}`,
    },
    {
      header: 'Semester',
      render: (g) => SEMESTER_LABELS[g.semester],
    },
    {
      header: 'Academic Year',
      render: (g) => g.academicYear,
    },
  ];

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">My grades &amp; report cards</h1>
      <LedgerRule />

      {/* ── Report cards ── */}
      <h2 className="mb-3 text-lg">Report cards</h2>
      {isReportsLoading ? (
        <p className="mb-6 text-sm text-slate-500">Loading…</p>
      ) : sortedReports.length === 0 ? (
        <div className="mb-6">
          <Card>
            <EmptyState
              title="No report card yet"
              description="Your school will generate this once grades for the semester are finalized."
            />
          </Card>
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          {sortedReports.map((r) => (
            <Card key={r.reportId}>
              <p className="mb-1 text-[0.8125rem] text-slate-500">
                {SEMESTER_LABELS[r.semester]} · {r.academicYear}
              </p>
              <div className="mb-3 flex items-baseline gap-2">
                <span className="font-display text-2xl font-semibold text-pine-900">
                  {r.averageMark}%
                </span>
                {r.rank && <Badge tone="positive">Rank #{r.rank}</Badge>}
              </div>
              <Button
                variant="ghost"
                onClick={() => void handleDownloadPdf(r)}
                isLoading={downloadingReportId === r.reportId}
              >
                Download PDF
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* ── All grades ── */}
      <h2 className="mb-3 text-lg">All grades</h2>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <SelectField
          label="Semester"
          className="min-w-[160px]"
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
      </div>

      <Table
        columns={columns}
        rows={gradesData ?? []}
        getRowKey={(g) => `${g.teacherSubjectId}-${g.semester}-${g.academicYear}`}
        isLoading={isGradesLoading}
        emptyMessage="No grades recorded yet."
      />
    </div>
  );
}
