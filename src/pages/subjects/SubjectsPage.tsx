import { useState } from 'react';
import { useSubjects, useDeleteSubject } from '../../hooks/useSubjects';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { CreateSubjectModal } from './CreateSubjectModal';
import type { SubjectSummary, ListSubjectsParams } from '../../types/subject';

export function SubjectsPage() {
  const [filters, setFilters] = useState<ListSubjectsParams>({ page: 1, limit: 20 });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SubjectSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading } = useSubjects(filters);
  const deleteSubject = useDeleteSubject();

  function updateFilter<K extends keyof ListSubjectsParams>(key: K, value: ListSubjectsParams[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleteError(null);
    try {
      await deleteSubject.mutateAsync(pendingDelete.subjectId);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this subject.');
    }
  }

  const columns: Column<SubjectSummary>[] = [
    { header: 'Code', className: 'font-mono text-[0.8125rem]', render: (s) => s.subjectCode },
    { header: 'Name', render: (s) => s.subjectName },
    {
      header: 'Actions',
      render: (s) => (
        <Button variant="ghost" onClick={() => setPendingDelete(s)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Subjects</h1>
      <LedgerRule />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <TextField
          label="Search"
          className="min-w-[220px]"
          placeholder="Code or name"
          defaultValue={filters.search ?? ''}
          onChange={(e) => updateFilter('search', e.target.value || undefined)}
        />

        <Button onClick={() => setCreateOpen(true)}>Add subject</Button>
      </div>

      <Table
        columns={columns}
        rows={data?.items ?? []}
        getRowKey={(s) => s.subjectId}
        isLoading={isLoading}
        emptyMessage="No subjects match this search."
      />

      {data && <Pagination meta={data.meta} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />}

      <CreateSubjectModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} onCreated={() => setCreateOpen(false)} />

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Delete subject"
        message={
          deleteError ??
          `Delete ${pendingDelete?.subjectName}? This cannot be undone. Subjects with existing assignments or grade records cannot be deleted.`
        }
        confirmLabel="Delete"
        isLoading={deleteSubject.isPending}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
