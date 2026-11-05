import { useMemo, useState } from 'react';
import { MdHistory } from 'react-icons/md';
import { useClassrooms, useClassroomRoster, useDeleteClassroom, useClassroomOptions } from '../../hooks/useClassrooms';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { CreateClassroomModal } from './CreateClassroomModal';
import type { ClassroomSummary, ClassroomRosterStudent, ListClassroomsParams } from '../../types/classroom';

// ── Roster modal ──────────────────────────────────────────────────────────────

interface RosterModalProps {
  classroomId: number | null;
  academicYear: string;
  classroomLabel: string;
  onClose: () => void;
}

function RosterModal({ classroomId, academicYear, classroomLabel, onClose }: RosterModalProps) {
  const { data, isLoading, error } = useClassroomRoster(classroomId, academicYear);

  const decisionBadge = (decision: string) => {
    switch (decision) {
      case 'PROMOTED':  return <Badge tone="positive">Promoted</Badge>;
      case 'REPEATED':  return <Badge tone="warning">Repeated</Badge>;
      case 'GRADUATED': return <Badge tone="positive">Graduated</Badge>;
      case 'ACTIVE':    return <Badge tone="neutral">Active</Badge>;
      default:          return <Badge>{decision}</Badge>;
    }
  };

  const columns: Column<ClassroomRosterStudent>[] = [
    { header: 'Admission #',  render: (s) => <span className="font-mono text-sm">{s.admissionNumber}</span> },
    { header: 'Name',         render: (s) => `${s.firstName} ${s.lastName}` },
    { header: 'Gender',       render: (s) => s.gender },
    { header: 'Status',       render: (s) => decisionBadge(s.enrollmentDecision) },
  ];

  return (
    <Modal
      title={`${classroomLabel} — ${academicYear}`}
      isOpen={Boolean(classroomId)}
      onClose={onClose}
      widthClassName="max-w-[640px]"
    >
      {data?.isHistorical && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2.5">
          <MdHistory className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
          <p className="text-sm text-gold-700">
            Historical roster — these students have since been promoted, repeated, or transferred.
            This record is read-only.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-8 text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
          <span className="text-sm">Loading roster…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3">
          <p className="text-sm text-danger-700">
            {error instanceof Error ? error.message : 'Could not load roster.'}
          </p>
        </div>
      )}

      {!isLoading && !error && data && (
        <>
          <p className="mb-3 text-sm text-slate-500">
            {data.students.length} student{data.students.length !== 1 ? 's' : ''}
            {data.homeroomTeacher && (
              <> · Homeroom: {data.homeroomTeacher.firstName} {data.homeroomTeacher.lastName}</>
            )}
          </p>
          {data.students.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              No students were enrolled in this classroom for {academicYear}.
            </p>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
              <Table
                columns={columns}
                rows={data.students}
                getRowKey={(s) => s.studentId}
                emptyMessage="No students."
              />
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ClassroomsPage() {
  const [filters, setFilters] = useState<ListClassroomsParams>({ page: 1, limit: 20 });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ClassroomSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [rosterTarget, setRosterTarget] = useState<{ classroomId: number; label: string } | null>(null);

  const { data, isLoading, error, refetch } = useClassrooms(filters);
  const { data: allClassrooms } = useClassroomOptions();
  const deleteClassroom = useDeleteClassroom();

  // Academic years derived from all classrooms (same pattern as other pages)
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    allClassrooms?.items.forEach((c) => years.add(c.academicYear));
    return Array.from(years).sort().reverse();
  }, [allClassrooms]);

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
    { header: 'Class',    render: (c) => `${c.className} ${c.section}` },
    { header: 'Year',     render: (c) => c.academicYear },
    {
      header: 'Homeroom teacher',
      render: (c) =>
        c.homeroomTeacher
          ? `${c.homeroomTeacher.firstName} ${c.homeroomTeacher.lastName}`
          : '—',
    },
    { header: 'Students', render: (c) => c.studentCount },
    {
      header: 'Actions',
      render: (c) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => setRosterTarget({ classroomId: c.classroomId, label: `${c.className} ${c.section}` })}
          >
            View roster
          </Button>
          <Button variant="ghost" onClick={() => setPendingDelete(c)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  // The roster modal needs a specific academic year; use the classroom's own year
  const rosterAcademicYear = rosterTarget
    ? (data?.items.find((c) => c.classroomId === rosterTarget.classroomId)?.academicYear ?? filters.academicYear ?? '')
    : '';

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Classrooms</h1>
      <LedgerRule />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Academic year filter — shows classrooms from a specific year */}
          <SelectField
            label="Academic year"
            className="min-w-[160px]"
            value={filters.academicYear ?? ''}
            onChange={(e) => updateFilter('academicYear', e.target.value || undefined)}
          >
            <option value="">All years</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </SelectField>

          <TextField
            label="Search"
            className="min-w-[200px]"
            placeholder="Class name or section"
            defaultValue={filters.search ?? ''}
            onChange={(e) => updateFilter('search', e.target.value || undefined)}
          />
        </div>

        <Button onClick={() => setCreateOpen(true)}>Add classroom</Button>
      </div>

      {filters.academicYear && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
          <MdHistory className="h-3.5 w-3.5" />
          Showing classrooms for <strong>{filters.academicYear}</strong>. Student counts reflect enrollment records for that year.
        </div>
      )}

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

      {/* Roster modal — read-only, shows historical or live roster */}
      <RosterModal
        classroomId={rosterTarget?.classroomId ?? null}
        academicYear={rosterAcademicYear}
        classroomLabel={rosterTarget?.label ?? ''}
        onClose={() => setRosterTarget(null)}
      />

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
