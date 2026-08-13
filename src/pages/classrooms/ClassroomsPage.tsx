import { useState } from 'react';
import { useClassrooms, useDeleteClassroom } from '../../hooks/useClassrooms';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { CreateClassroomModal } from './CreateClassroomModal';
import type { ClassroomSummary, ListClassroomsParams } from '../../types/classroom';

export function ClassroomsPage() {
  const [filters, setFilters] = useState<ListClassroomsParams>({ page: 1, limit: 20 });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ClassroomSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useClassrooms(filters);
  const deleteClassroom = useDeleteClassroom();

  function updateFilter<K extends keyof ListClassroomsParams>(key: K, value: ListClassroomsParams[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleteError(null);
    try {
      await deleteClassroom.mutateAsync(pendingDelete.classroomId);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this classroom.');
    }
  }

  const columns: Column<ClassroomSummary>[] = [
    { header: 'Class', render: (c) => `${c.className} ${c.section}` },
    { header: 'Academic year', render: (c) => c.academicYear },
    {
      header: 'Homeroom teacher',
      render: (c) => (c.homeroomTeacher ? `${c.homeroomTeacher.firstName} ${c.homeroomTeacher.lastName}` : '—'),
    },
    { header: 'Students', render: (c) => c.studentCount },
    {
      header: 'Actions',
      render: (c) => (
        <Button variant="ghost" onClick={() => setPendingDelete(c)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Classrooms</h1>
      <LedgerRule />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <TextField
          label="Search"
          className="min-w-[220px]"
          placeholder="Class name or section"
          defaultValue={filters.search ?? ''}
          onChange={(e) => updateFilter('search', e.target.value || undefined)}
        />

        <Button onClick={() => setCreateOpen(true)}>Add classroom</Button>
      </div>

      <Table
        columns={columns}
        rows={data?.items ?? []}
        getRowKey={(c) => c.classroomId}
        isLoading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        emptyMessage="No classrooms match this search."
      />

      {data && <Pagination meta={data.meta} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />}

      <CreateClassroomModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} onCreated={() => setCreateOpen(false)} />

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Delete classroom"
        message={
          deleteError ??
          `Delete ${pendingDelete?.className} ${pendingDelete?.section}? This cannot be undone. Classrooms with enrolled students cannot be deleted.`
        }
        confirmLabel="Delete"
        isLoading={deleteClassroom.isPending}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
