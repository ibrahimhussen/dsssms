import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdAdd, MdChevronRight } from 'react-icons/md';
import { usePromotionBatches, useCreatePromotionBatch } from '../../hooks/usePromotion';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { useAuth } from '../../context/AuthContext';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import type { PromotionBatchSummary, BatchStatus } from '../../types/promotion';

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: BatchStatus) {
  switch (status) {
    case 'DRAFT':      return <Badge tone="neutral">Draft</Badge>;
    case 'SUBMITTED':  return <Badge tone="warning">Awaiting approval</Badge>;
    case 'APPROVED':   return <Badge tone="positive">Approved</Badge>;
    case 'REJECTED':   return <Badge tone="danger">Rejected</Badge>;
    case 'COMPLETED':  return <Badge tone="positive">Completed</Badge>;
    default:           return null;
  }
}

// ── Create batch modal ────────────────────────────────────────────────────────

interface CreateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (batchId: number) => void;
}

function CreateBatchModal({ isOpen, onClose, onCreated }: CreateBatchModalProps) {
  const { data: classroomsData } = useClassroomOptions();
  const createBatch = useCreatePromotionBatch();
  const [sourceClassroomId, setSourceClassroomId] = useState<string>('');
  const [targetAcademicYear, setTargetAcademicYear] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceClassroomId || !targetAcademicYear.trim()) return;
    setError(null);
    try {
      const result = await createBatch.mutateAsync({
        sourceClassroomId: Number(sourceClassroomId),
        targetAcademicYear: targetAcademicYear.trim(),
      });
      onCreated(result.batch.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the promotion batch.');
    }
  }

  function handleClose() {
    setSourceClassroomId('');
    setTargetAcademicYear('');
    setError(null);
    onClose();
  }

  return (
    <Modal title="New Promotion Batch" isOpen={isOpen} onClose={handleClose} widthClassName="max-w-[500px]">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <p className="mb-5 text-sm text-ink-700">
          Select the classroom whose students you want to evaluate for promotion, and the academic year they
          will move into.
        </p>

        <SelectField
          label="Source classroom"
          value={sourceClassroomId}
          onChange={(e) => setSourceClassroomId(e.target.value)}
        >
          <option value="">Select a classroom…</option>
          {classroomsData?.items.map((c) => (
            <option key={c.classroomId} value={c.classroomId}>
              {c.className} {c.section} ({c.academicYear})
            </option>
          ))}
        </SelectField>

        <TextField
          label="Target academic year"
          placeholder="e.g. 2027/28"
          value={targetAcademicYear}
          onChange={(e) => setTargetAcademicYear(e.target.value)}
        />

        {error && (
          <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={createBatch.isPending}
            disabled={!sourceClassroomId || !targetAcademicYear.trim()}
          >
            Create batch
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PromotionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const { data, isLoading } = usePromotionBatches({ page: 1, limit: 50 });

  const canPrepare = user?.role === 'DIRECTOR' || user?.role === 'VICE_DIRECTOR';

  const columns: Column<PromotionBatchSummary>[] = [
    {
      header: 'Source classroom',
      render: (b) => (
        <span className="font-medium text-ink-900">{b.sourceClassroomLabel}</span>
      ),
    },
    { header: 'Source year', render: (b) => b.sourceAcademicYear },
    { header: 'Target year', render: (b) => b.targetAcademicYear },
    {
      header: 'Students',
      render: (b) => (
        <span className="font-mono text-sm">
          {b.totalStudents} total &nbsp;·&nbsp;
          <span className="text-pine-700">{b.eligibleCount} eligible</span>
          {b.pendingCount > 0 && <> &nbsp;·&nbsp; <span className="text-gold-600">{b.pendingCount} pending</span></>}
          {b.notEligibleCount > 0 && <> &nbsp;·&nbsp; <span className="text-danger-600">{b.notEligibleCount} not eligible</span></>}
        </span>
      ),
    },
    { header: 'Status', render: (b) => statusBadge(b.status) },
    { header: 'Prepared by', render: (b) => b.preparedBy },
    {
      header: '',
      render: (b) => (
        <Button
          variant="ghost"
          onClick={() => navigate(`/promotion/${b.id}`)}
          className="gap-1"
        >
          Open <MdChevronRight className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="max-w-full">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl">Student Promotion</h1>
        {canPrepare && (
          <Button onClick={() => setCreateOpen(true)}>
            <MdAdd className="h-4 w-4" />
            New batch
          </Button>
        )}
      </div>
      <LedgerRule />

      {!isLoading && data?.items.length === 0 ? (
        <EmptyState
          title="No promotion batches yet"
          description="Create a new batch to begin evaluating students for promotion to the next academic year."
        />
      ) : (
        <Table
          columns={columns}
          rows={data?.items ?? []}
          getRowKey={(b) => b.id}
          isLoading={isLoading}
          emptyMessage="No promotion batches found."
        />
      )}

      <CreateBatchModal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          navigate(`/promotion/${id}`);
        }}
      />
    </div>
  );
}
