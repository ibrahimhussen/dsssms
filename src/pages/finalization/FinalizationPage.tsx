import { useState } from 'react';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { useTeacherOptions } from '../../hooks/useTeacherOptions';
import { useClassroomSubjectFinalizations, useSubmitForReview, useReviewSubject, useFinalizeSubject, useFinalizeClassroom } from '../../hooks/useFinalization';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import type { Semester } from '../../types/grade';
import type { SubjectFinalization } from '../../types/finalization';

function currentAcademicYear(): string {
  const year = new Date().getFullYear();
  return `${year}/${String(year + 1).slice(2)}`;
}

export function FinalizationPage() {
  const { data: classroomsData } = useClassroomOptions();
  const { data: teachersData } = useTeacherOptions();
  const [classroomId, setClassroomId] = useState<number | undefined>(undefined);
  const [teacherId, setTeacherId] = useState<number | undefined>(undefined);
  const [semester, setSemester] = useState<Semester>('SEMESTER_1');
  const [academicYear, setAcademicYear] = useState<string>(currentAcademicYear());

  const { data: subjectFinalizations, isLoading, error } = useClassroomSubjectFinalizations(
    classroomId ?? 0,
    semester,
    academicYear
  );

  const submitForReview = useSubmitForReview();
  const reviewSubject = useReviewSubject();
  const finalizeSubject = useFinalizeSubject();
  const finalizeClassroom = useFinalizeClassroom();

  const handleSubmitForReview = async (teacherSubjectId: number) => {
    try {
      await submitForReview.mutateAsync({
        teacherSubjectId,
        semester,
        academicYear,
      });
    } catch (err) {
      console.error('Submit failed:', err);
    }
  };

  const handleReview = async (teacherSubjectId: number, approved: boolean, reviewNotes?: string) => {
    try {
      await reviewSubject.mutateAsync({
        teacherSubjectId,
        semester,
        academicYear,
        approved,
        reviewNotes,
      });
    } catch (err) {
      console.error('Review failed:', err);
    }
  };

  const handleFinalizeSubject = async (teacherSubjectId: number) => {
    try {
      await finalizeSubject.mutateAsync({
        teacherSubjectId,
        semester,
        academicYear,
      });
    } catch (err) {
      console.error('Finalize failed:', err);
    }
  };

  const handleFinalizeClassroom = async () => {
    if (!classroomId) return;
    try {
      await finalizeClassroom.mutateAsync({
        classroomId,
        semester,
        academicYear,
      });
    } catch (err) {
      console.error('Finalize classroom failed:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge tone="neutral">PENDING</Badge>;
      case 'SUBMITTED':
        return <Badge tone="warning">SUBMITTED</Badge>;
      case 'APPROVED':
        return <Badge tone="positive">APPROVED</Badge>;
      case 'REJECTED':
        return <Badge tone="danger">REJECTED</Badge>;
      case 'FINALIZED':
        return <Badge tone="positive">FINALIZED</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const columns: Column<SubjectFinalization>[] = [
    { header: 'Subject', render: (f) => `Subject #${f.teacherSubjectId}` },
    { header: 'Status', render: (f) => getStatusBadge(f.status) },
    { header: 'Students', render: (f) => f.studentCount },
    { header: 'Missing Results', render: (f) => f.missingResultsCount },
    { header: 'Submitted', render: (f) => f.submittedAt ? new Date(f.submittedAt).toLocaleDateString() : '—' },
    { header: 'Reviewed By', render: (f) => f.reviewedBy ? `${f.reviewedBy.firstName} ${f.reviewedBy.lastName}` : '—' },
    { header: 'Finalized By', render: (f) => f.finalizedBy ? `${f.finalizedBy.firstName} ${f.finalizedBy.lastName}` : '—' },
    {
      header: 'Actions',
      render: (f) => (
        <div className="flex gap-2">
          {f.status === 'PENDING' && (
            <Button
              onClick={() => handleSubmitForReview(f.teacherSubjectId)}
              isLoading={submitForReview.isPending}
            >
              Submit
            </Button>
          )}
          {f.status === 'SUBMITTED' && (
            <>
              <Button
                variant="secondary"
                onClick={() => handleReview(f.teacherSubjectId, true)}
                isLoading={reviewSubject.isPending}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                onClick={() => handleReview(f.teacherSubjectId, false)}
                isLoading={reviewSubject.isPending}
              >
                Reject
              </Button>
            </>
          )}
          {f.status === 'APPROVED' && (
            <Button
              onClick={() => handleFinalizeSubject(f.teacherSubjectId)}
              isLoading={finalizeSubject.isPending}
            >
              Finalize
            </Button>
          )}
        </div>
      ),
    },
  ];

  const allSubjectsFinalized = subjectFinalizations?.every(f => f.status === 'FINALIZED') ?? false;

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Results Finalization</h1>
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

        <SelectField
          label="Teacher"
          className="min-w-[220px]"
          value={teacherId ?? ''}
          onChange={(e) => setTeacherId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">All teachers…</option>
          {teachersData?.items.map((t) => (
            <option key={t.userId} value={t.userId}>
              {t.fullName}
            </option>
          ))}
        </SelectField>

        <SelectField label="Semester" value={semester} onChange={(e) => setSemester(e.target.value as Semester)}>
          <option value="SEMESTER_1">Semester 1</option>
          <option value="SEMESTER_2">Semester 2</option>
        </SelectField>

        <TextField label="Academic year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
          {error instanceof Error ? error.message : 'Failed to load finalization data.'}
        </p>
      )}

      {isLoading ? (
        <EmptyState title="Loading..." description="Please wait while we load the finalization data." />
      ) : !subjectFinalizations || subjectFinalizations.length === 0 ? (
        <EmptyState
          title="No subjects found"
          description="Select a classroom to view subject finalization status."
        />
      ) : (
        <>
          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-slate-600">
              {subjectFinalizations.length} subject(s) • {subjectFinalizations.filter(f => f.status === 'FINALIZED').length} finalized
            </p>
            {allSubjectsFinalized && (
              <Button
                onClick={handleFinalizeClassroom}
                isLoading={finalizeClassroom.isPending}
              >
                Finalize Classroom
              </Button>
            )}
          </div>

          <Table
            columns={columns}
            rows={subjectFinalizations}
            getRowKey={(f) => f.id}
            emptyMessage="No subjects found for the selected classroom."
          />
        </>
      )}
    </div>
  );
}
