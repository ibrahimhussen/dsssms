import { useState } from 'react';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { useGenerateClassroomReports } from '../../hooks/useAcademicReports';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { EmptyState } from '../../components/ui/EmptyState';
import type { AcademicReport } from '../../types/academic-report';
import type { Semester } from '../../types/grade';

function currentAcademicYear(): string {
  const year = new Date().getFullYear();
  return `${year}/${String(year + 1).slice(2)}`;
}

export function AcademicReportsPage() {
  const { data: classroomsData } = useClassroomOptions();
  const [classroomId, setClassroomId] = useState<number | undefined>(undefined);
  const [semester, setSemester] = useState<Semester>('SEMESTER_1');
  const [academicYear, setAcademicYear] = useState<string>(currentAcademicYear());
  const [result, setResult] = useState<{ generated: AcademicReport[]; skippedStudentIds: number[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateReports = useGenerateClassroomReports();

  async function handleGenerate() {
    if (!classroomId) return;
    setError(null);
    try {
      const outcome = await generateReports.mutateAsync({ classroomId, semester, academicYear });
      setResult(outcome);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate reports.');
    }
  }

  const columns: Column<AcademicReport>[] = [
    { header: 'Rank', render: (r) => r.rank ?? '—' },
    { header: 'Student', render: (r) => r.studentName },
    { header: 'Average mark', render: (r) => r.averageMark.toFixed(2) },
  ];

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Academic reports</h1>
      <LedgerRule />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <SelectField
          label="Classroom"
          className="min-w-[220px]"
          value={classroomId ?? ''}
          onChange={(e) => setClassroomId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Select a classroom…</option>
          {classroomsData?.items.map((c) => (
            <option key={c.classroomId} value={c.classroomId}>
              {c.className} {c.section} ({c.academicYear})
            </option>
          ))}
        </SelectField>

        <SelectField label="Semester" value={semester} onChange={(e) => setSemester(e.target.value as Semester)}>
          <option value="SEMESTER_1">Semester 1</option>
          <option value="SEMESTER_2">Semester 2</option>
        </SelectField>

        <TextField label="Academic year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />

        <Button onClick={() => void handleGenerate()} isLoading={generateReports.isPending} disabled={!classroomId}>
          Generate reports
        </Button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
          {error}
        </p>
      )}

      {!result ? (
        <EmptyState
          title="No reports generated yet"
          description="Select a classroom, semester, and academic year, then generate to compute class rank and averages."
        />
      ) : (
        <>
          {result.skippedStudentIds.length > 0 && (
            <p className="mb-4 rounded-lg bg-gold-100 px-3 py-2.5 text-sm text-gold-600">
              {result.skippedStudentIds.length} student(s) had no grades recorded for this period and were skipped.
            </p>
          )}
          <Table
            columns={columns}
            rows={result.generated}
            getRowKey={(r) => r.reportId}
            emptyMessage="No students had grades recorded for this period."
          />
        </>
      )}
    </div>
  );
}
