import { useState } from 'react';
import { useAssignments, useDeleteAssignment } from '../../hooks/useTeacherSubjects';
import { useTeacherOptions } from '../../hooks/useTeacherOptions';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Badge } from '../../components/ui/Badge';
import { CreateAssignmentModal } from './CreateAssignmentModal';
import type { TeacherSubjectAssignment, ListAssignmentsParams } from '../../types/teacher-subject';

export function TeacherAssignmentsPage() {
  const [filters, setFilters] = useState<ListAssignmentsParams>({ page: 1, limit: 20 });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TeacherSubjectAssignment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading } = useAssignments(filters);
  const { data: teachersData } = useTeacherOptions();
  const { data: classroomsData } = useClassroomOptions();
  const deleteAssignment = useDeleteAssignment();

  function updateFilter<K extends keyof ListAssignmentsParams>(key: K, value: ListAssignmentsParams[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleteError(null);
    try {
      await deleteAssignment.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not remove this assignment.');
    }
  }

  const columns: Column<TeacherSubjectAssignment>[] = [
    { header: 'Teacher', render: (a) => `${a.teacher.firstName} ${a.teacher.lastName}` },
    { header: 'Subject', render: (a) => `${a.subject.subjectName} (${a.subject.subjectCode})` },
    {
      header: 'Classroom',
      render: (a) => `${a.classroom.className} ${a.classroom.section} (${a.classroom.academicYear})`,
    },
    {
      header: 'Approval Status',
      render: () => <Badge tone="positive">APPROVED</Badge>,
    },
    {
      header: 'Actions',
      render: (a) => (
        <Button variant="ghost" onClick={() => setPendingDelete(a)}>
          Remove
        </Button>
      ),
    },
  ];

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Teaching assignments</h1>
      <LedgerRule />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Teacher"
            className="min-w-[180px]"
            value={filters.teacherId ?? ''}
            onChange={(e) => updateFilter('teacherId', e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All teachers</option>
            {teachersData?.items.map((t) => (
              <option key={t.userId} value={t.teacherId ?? undefined}>
                {t.fullName}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Classroom"
            className="min-w-[200px]"
            value={filters.classroomId ?? ''}
            onChange={(e) => updateFilter('classroomId', e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All classrooms</option>
            {classroomsData?.items.map((c) => (
              <option key={c.classroomId} value={c.classroomId}>
                {c.className} {c.section} ({c.academicYear})
              </option>
            ))}
          </SelectField>
        </div>

        <Button onClick={() => setCreateOpen(true)}>Add assignment</Button>
      </div>

      <Table
        columns={columns}
        rows={data?.items ?? []}
        getRowKey={(a) => a.id}
        isLoading={isLoading}
        emptyMessage="No teaching assignments match these filters."
      />

      {data && <Pagination meta={data.meta} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />}

      <CreateAssignmentModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} onCreated={() => setCreateOpen(false)} />

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Remove assignment"
        message={
          deleteError ??
          `Remove ${pendingDelete?.teacher.firstName} ${pendingDelete?.teacher.lastName} from ${pendingDelete?.subject.subjectName} in ${pendingDelete?.classroom.className} ${pendingDelete?.classroom.section}?`
        }
        confirmLabel="Remove"
        isLoading={deleteAssignment.isPending}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
