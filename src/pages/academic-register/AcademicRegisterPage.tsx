import { useState } from 'react';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { useAcademicRegister } from '../../hooks/useAcademicRegister';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { academicRegisterApi } from '../../lib/academic-register-api';
import type { AcademicRegisterQuery, AcademicRegisterStudent } from '../../types/academic-register';
import type { Semester } from '../../types/grade';

function currentAcademicYear(): string {
  const year = new Date().getFullYear();
  return `${year}/${String(year + 1).slice(2)}`;
}

export function AcademicRegisterPage() {
  const { data: classroomsData } = useClassroomOptions();
  const [classroomId, setClassroomId] = useState<number | undefined>(undefined);
  const [grade, setGrade] = useState<string>('');
  const [section, setSection] = useState<string>('');
  const [semester, setSemester] = useState<Semester>('SEMESTER_1');
  const [academicYear, setAcademicYear] = useState<string>(currentAcademicYear());
  const [gradeWide, setGradeWide] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  const query: AcademicRegisterQuery = {
    classroomId: gradeWide ? undefined : classroomId,
    grade: gradeWide ? grade : undefined,
    section: gradeWide ? section : undefined,
    academicYear,
    semester,
    gradeWide,
    page,
    limit,
  };

  const { data: registerData, isLoading, error } = useAcademicRegister(query);

  const handleExportExcel = async () => {
    try {
      const blob = await academicRegisterApi.exportToExcel(query);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `academic-register-${academicYear}-${semester}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleExportCSV = async () => {
    try {
      const blob = await academicRegisterApi.exportToCSV(query);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `academic-register-${academicYear}-${semester}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const getAcademicStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return <Badge tone="positive">PASS</Badge>;
      case 'FAIL':
        return <Badge tone="danger">FAIL</Badge>;
      case 'INCOMPLETE':
        return <Badge tone="warning">INCOMPLETE</Badge>;
      case 'PENDING':
        return <Badge tone="neutral">PENDING</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Build dynamic columns based on available subjects
  const getColumns = (students: AcademicRegisterStudent[]): Column<AcademicRegisterStudent>[] => {
    if (!students || students.length === 0) {
      return [
        { header: 'Student', render: (s) => s.studentName },
        { header: 'Total', render: (s) => s.total.toFixed(2) },
        { header: 'Average', render: (s) => s.average.toFixed(2) },
        { header: 'Status', render: (s) => getAcademicStatusBadge(s.academicStatus) },
      ];
    }

    const subjects = new Set<string>();
    students.forEach(student => {
      student.subjectResults.forEach(sr => subjects.add(sr.subjectName));
    });
    const sortedSubjects = Array.from(subjects).sort();

    const columns: Column<AcademicRegisterStudent>[] = [
      { header: 'Student', render: (s: AcademicRegisterStudent) => s.studentName },
      ...sortedSubjects.map(subject => ({
        header: subject,
        render: (s: AcademicRegisterStudent) => {
          const result = s.subjectResults.find((sr: any) => sr.subjectName === subject);
          return result && result.finalResult !== null ? `${result.finalResult}/100` : '—';
        },
      })),
      { header: 'Total', render: (s: AcademicRegisterStudent) => s.total.toFixed(2) },
      { header: 'Average', render: (s: AcademicRegisterStudent) => s.average.toFixed(2) },
      { header: 'Section Rank', render: (s) => s.sectionRank ?? '—' },
      { header: 'Grade Rank', render: (s) => s.gradeRank ?? '—' },
      { header: 'Conduct', render: (s) => s.conduct || '—' },
      { header: 'Status', render: (s) => getAcademicStatusBadge(s.academicStatus) },
    ];

    return columns;
  };

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Academic Register</h1>
      <LedgerRule />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        {!gradeWide ? (
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
        ) : (
          <>
            <TextField
              label="Grade"
              className="min-w-[150px]"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="e.g., 10"
            />
            <TextField
              label="Section"
              className="min-w-[150px]"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g., A"
            />
          </>
        )}

        <SelectField label="Semester" value={semester} onChange={(e) => setSemester(e.target.value as Semester)}>
          <option value="SEMESTER_1">Semester 1</option>
          <option value="SEMESTER_2">Semester 2</option>
        </SelectField>

        <TextField label="Academic year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />

        <SelectField
          label="View"
          value={gradeWide ? 'grade' : 'classroom'}
          onChange={(e) => setGradeWide(e.target.value === 'grade')}
        >
          <option value="classroom">Classroom</option>
          <option value="grade">Grade-wide</option>
        </SelectField>

        <SelectField
          label="Results per page"
          value={limit.toString()}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </SelectField>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
          {error instanceof Error ? error.message : 'Failed to load academic register.'}
        </p>
      )}

      {isLoading ? (
        <EmptyState title="Loading..." description="Please wait while we load the academic register." />
      ) : !registerData ? (
        <EmptyState
          title="No register loaded"
          description="Select a classroom or grade-wide view to generate the academic register."
        />
      ) : (
        <>
          {/* Metadata Summary */}
          <div className="mb-6 rounded-lg bg-slate-50 p-4">
            <h3 className="mb-3 font-semibold">Register Summary</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-slate-600">Class/Grade</p>
                <p className="font-medium">{registerData.metadata.classroomLabel}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Period</p>
                <p className="font-medium">{registerData.metadata.semester} {registerData.metadata.academicYear}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Students</p>
                <p className="font-medium">{registerData.metadata.totalStudents}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Class Average</p>
                <p className="font-medium">{registerData.metadata.classAverage.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Passed</p>
                <p className="font-medium text-green-600">{registerData.metadata.passedCount}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Failed</p>
                <p className="font-medium text-red-600">{registerData.metadata.failedCount}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Incomplete</p>
                <p className="font-medium text-yellow-600">{registerData.metadata.incompleteCount}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Pending</p>
                <p className="font-medium text-slate-600">{registerData.metadata.pendingCount}</p>
              </div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="mb-4 flex gap-2">
            <Button onClick={handleExportExcel} variant="secondary">
              Export Excel
            </Button>
            <Button onClick={handleExportCSV} variant="secondary">
              Export CSV
            </Button>
          </div>

          {/* Academic Register Table */}
          <Table
            columns={getColumns(registerData.students)}
            rows={registerData.students}
            getRowKey={(s) => s.studentId}
            emptyMessage="No students found for the selected criteria."
          />

          {/* Pagination */}
          {registerData.pagination && registerData.pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page {registerData.pagination.page} of {registerData.pagination.totalPages} ({registerData.pagination.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={registerData.pagination.page === 1}
                  variant="secondary"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => setPage(p => Math.min(registerData.pagination!.totalPages, p + 1))}
                  disabled={registerData.pagination.page === registerData.pagination.totalPages}
                  variant="secondary"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
