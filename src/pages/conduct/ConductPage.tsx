import { useState } from 'react';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { useClassroomConducts, useClassroomConductSummary, useUpdateConduct, useDeleteConduct } from '../../hooks/useConduct';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import type { Semester } from '../../types/grade';
import type { StudentConduct } from '../../types/conduct';

function currentAcademicYear(): string {
  const year = new Date().getFullYear();
  return `${year}/${String(year + 1).slice(2)}`;
}

export function ConductPage() {
  const { data: classroomsData } = useClassroomOptions();
  const [classroomId, setClassroomId] = useState<number | undefined>(undefined);
  const [semester, setSemester] = useState<Semester>('SEMESTER_1');
  const [academicYear, setAcademicYear] = useState<string>(currentAcademicYear());
  const [selectedStudent, setSelectedStudent] = useState<StudentConduct | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: conductData, isLoading, error } = useClassroomConducts(
    classroomId ?? 0,
    semester,
    academicYear
  );

  const { data: summaryData } = useClassroomConductSummary(
    classroomId ?? 0,
    semester,
    academicYear
  );

  const updateConduct = useUpdateConduct();
  const deleteConduct = useDeleteConduct();

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSaveConduct = async (rating: string, notes?: string) => {
    setSaveError(null);
    if (!classroomId) return;
    try {
      if (selectedStudent) {
        await updateConduct.mutateAsync({ id: selectedStudent.id, input: { rating: rating as any, notes } });
      }
      setShowEditModal(false);
      setSelectedStudent(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save conduct record.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this conduct record?')) return;
    setDeleteError(null);
    try {
      await deleteConduct.mutateAsync(id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this conduct record.');
    }
  };

  const getRatingBadge = (rating: string) => {
    switch (rating) {
      case 'EXCELLENT':
        return <Badge tone="positive">Excellent</Badge>;
      case 'VERY_GOOD':
        return <Badge tone="positive">Very Good</Badge>;
      case 'GOOD':
        return <Badge tone="warning">Good</Badge>;
      case 'SATISFACTORY':
        return <Badge tone="neutral">Satisfactory</Badge>;
      case 'NEEDS_IMPROVEMENT':
        return <Badge tone="danger">Needs Improvement</Badge>;
      default:
        return <Badge>{rating}</Badge>;
    }
  };

  const columns: Column<StudentConduct>[] = [
    { header: 'Student', render: (c) => c.studentName },
    { header: 'Rating', render: (c) => getRatingBadge(c.rating) },
    { header: 'Notes', render: (c) => c.notes || '—' },
    { header: 'Assigned', render: (c) => new Date(c.assignedAt).toLocaleDateString() },
    { header: 'Assigned By', render: (c) => `${c.assignedBy.firstName} ${c.assignedBy.lastName}` },
    {
      header: 'Actions',
      render: (c) => (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => { setSaveError(null); setSelectedStudent(c); setShowEditModal(true); }}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            onClick={() => handleDelete(c.id)}
            isLoading={deleteConduct.isPending}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Student Conduct</h1>
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
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
          {error instanceof Error ? error.message : 'Failed to load conduct data.'}
        </p>
      )}

      {deleteError && (
        <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
          {deleteError}
        </p>
      )}

      {summaryData && (
        <div className="mb-6 rounded-lg bg-slate-50 p-4">
          <h3 className="mb-3 font-semibold">Conduct Summary</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div>
              <p className="text-sm text-slate-600">Total Students</p>
              <p className="font-medium">{summaryData.totalStudents}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Assigned</p>
              <p className="font-medium">{summaryData.assignedCount}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Excellent</p>
              <p className="font-medium text-green-600">{summaryData.ratingDistribution.EXCELLENT}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Very Good</p>
              <p className="font-medium text-green-600">{summaryData.ratingDistribution.VERY_GOOD}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Needs Improvement</p>
              <p className="font-medium text-red-600">{summaryData.ratingDistribution.NEEDS_IMPROVEMENT}</p>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <EmptyState title="Loading..." description="Please wait while we load the conduct data." />
      ) : !conductData || conductData.length === 0 ? (
        <EmptyState
          title="No conduct records found"
          description="Select a classroom to view and manage student conduct ratings."
        />
      ) : (
        <Table
          columns={columns}
          rows={conductData}
          getRowKey={(c) => c.id}
          emptyMessage="No conduct records found for the selected classroom."
        />
      )}

      {showEditModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Edit Conduct</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Student</label>
                <p className="text-slate-600">{selectedStudent.studentName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rating</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  defaultValue={selectedStudent.rating}
                  id="conduct-rating"
                >
                  <option value="EXCELLENT">Excellent</option>
                  <option value="VERY_GOOD">Very Good</option>
                  <option value="GOOD">Good</option>
                  <option value="SATISFACTORY">Satisfactory</option>
                  <option value="NEEDS_IMPROVEMENT">Needs Improvement</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  defaultValue={selectedStudent.notes || ''}
                  id="conduct-notes"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const rating = (document.getElementById('conduct-rating') as HTMLSelectElement).value;
                    const notes = (document.getElementById('conduct-notes') as HTMLTextAreaElement).value;
                    handleSaveConduct(rating, notes);
                  }}
                  isLoading={updateConduct.isPending}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
