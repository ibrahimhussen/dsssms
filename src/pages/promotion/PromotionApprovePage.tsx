import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdArrowBack, MdCheckCircle, MdWarning, MdThumbUp, MdThumbDown } from 'react-icons/md';
import { usePromotionBatch, useApprovePromotionBatch, useRejectPromotionBatch } from '../../hooks/usePromotion';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { PromotionEntry, EligibilityStatus, PromotionDecision } from '../../types/promotion';

// ── Helpers ───────────────────────────────────────────────────────────────────

function eligibilityBadge(s: EligibilityStatus) {
  switch (s) {
    case 'ELIGIBLE':       return <Badge tone="positive">Eligible</Badge>;
    case 'PENDING_REVIEW': return <Badge tone="warning">Pending review</Badge>;
    case 'NOT_ELIGIBLE':   return <Badge tone="danger">Not eligible</Badge>;
  }
}

function decisionBadge(d: PromotionDecision) {
  switch (d) {
    case 'PROMOTED':  return <Badge tone="positive">Promoted</Badge>;
    case 'REPEATED':  return <Badge tone="warning">Repeat year</Badge>;
    case 'GRADUATED': return <Badge tone="positive">Graduated</Badge>;
  }
}

// ── Reject modal ──────────────────────────────────────────────────────────────

interface RejectModalProps {
  isOpen: boolean;
  batchId: number;
  isLoading: boolean;
  onReject: (reason: string) => void;
  onClose: () => void;
}

function RejectModal({ isOpen, batchId: _batchId, isLoading, onReject, onClose }: RejectModalProps) {
  const [reason, setReason] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    onReject(reason.trim());
  }

  return (
    <Modal title="Reject promotion batch" isOpen={isOpen} onClose={onClose} widthClassName="max-w-[480px]">
      <form onSubmit={handleSubmit} noValidate>
        <p className="mb-4 text-sm text-ink-700">
          Please explain why this batch is being rejected. The Vice Director will see this
          reason and can revise and resubmit.
        </p>
        <TextAreaField
          label="Rejection reason"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Several students are missing Semester 2 results — please regenerate reports before resubmitting."
        />
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" isLoading={isLoading} disabled={!reason.trim()}>
            Reject batch
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PromotionApprovePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const batchId = id ? Number(id) : null;

  const { data: batch, isLoading } = usePromotionBatch(batchId);
  const approveBatch = useApprovePromotionBatch();
  const rejectBatch = useRejectPromotionBatch();

  const [isApproveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [isRejectOpen, setRejectOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleApprove() {
    if (!batchId) return;
    setActionError(null);
    try {
      await approveBatch.mutateAsync(batchId);
      setApproveConfirmOpen(false);
      navigate('/promotion');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not approve the batch.');
      setApproveConfirmOpen(false);
    }
  }

  async function handleReject(reason: string) {
    if (!batchId) return;
    setActionError(null);
    try {
      await rejectBatch.mutateAsync({ batchId, input: { rejectionReason: reason } });
      setRejectOpen(false);
      navigate('/promotion');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reject the batch.');
      setRejectOpen(false);
    }
  }

  if (isLoading || !batch) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <span className="mr-2 inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700" />
        Loading…
      </div>
    );
  }

  if (batch.status !== 'SUBMITTED') {
    return (
      <div className="max-w-full">
        <div className="mb-1 flex items-center gap-3">
          <button
            onClick={() => navigate(`/promotion/${batch.id}`)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-paper-100"
            aria-label="Back"
          >
            <MdArrowBack className="h-5 w-5" />
          </button>
          <h1 className="text-2xl">Promotion approval</h1>
        </div>
        <LedgerRule />
        <p className="text-sm text-slate-500">
          This batch is currently <strong>{batch.status.toLowerCase()}</strong> and is not awaiting approval.
        </p>
      </div>
    );
  }

  const promotedCount  = batch.entries.filter((e) => e.decision === 'PROMOTED').length;
  const repeatedCount  = batch.entries.filter((e) => e.decision === 'REPEATED').length;
  const graduatedCount = batch.entries.filter((e) => e.decision === 'GRADUATED').length;

  const columns: Column<PromotionEntry>[] = [
    {
      header: 'Student',
      render: (e) => (
        <div>
          <span className="font-medium text-ink-900">{e.studentName}</span>
          <span className="ml-2 font-mono text-xs text-slate-500">{e.admissionNumber}</span>
        </div>
      ),
    },
    {
      header: 'Average',
      render: (e) =>
        e.averageMark !== null ? (
          <span className="font-mono text-sm">{e.averageMark}%</span>
        ) : (
          <span className="text-slate-400 text-sm">No reports</span>
        ),
    },
    { header: 'Eligibility', render: (e) => eligibilityBadge(e.eligibilityStatus) },
    { header: 'Decision', render: (e) => decisionBadge(e.decision) },
    {
      header: 'Moving to',
      render: (e) =>
        e.decision === 'GRADUATED' ? (
          <Badge tone="positive">Graduated — no classroom</Badge>
        ) : (
          <span className="text-sm">{e.targetClassroomLabel ?? '—'}</span>
        ),
    },
    {
      header: 'Override',
      render: (e) =>
        e.overrideReason ? (
          <span className="text-xs text-amber-700 italic" title={e.overrideReason}>
            {e.overrideReason.length > 40 ? e.overrideReason.slice(0, 40) + '…' : e.overrideReason}
          </span>
        ) : (
          <span className="text-slate-400 text-sm">—</span>
        ),
    },
  ];

  return (
    <div className="max-w-full">
      {/* ── Header ── */}
      <div className="mb-1 flex items-center gap-3">
        <button
          onClick={() => navigate(`/promotion/${batch.id}`)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-paper-100"
          aria-label="Back"
        >
          <MdArrowBack className="h-5 w-5" />
        </button>
        <h1 className="text-2xl">Review &amp; approve promotion</h1>
      </div>
      <LedgerRule />

      {/* ── Meta card ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Source classroom</p>
          <p className="font-semibold text-ink-900">{batch.sourceClassroomLabel}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Target year</p>
          <p className="font-semibold text-ink-900">{batch.targetAcademicYear}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Prepared by</p>
          <p className="font-semibold text-ink-900">{batch.preparedBy}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Submitted</p>
          <p className="font-semibold text-ink-900">
            {batch.submittedAt ? new Date(batch.submittedAt).toLocaleDateString() : '—'}
          </p>
        </div>
      </div>

      {/* ── Promotion preview summary ── */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-ink-900">Promotion preview</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-paper-50 border border-slate-200 p-3 text-center">
            <p className="text-2xl font-bold text-ink-900">{batch.totalStudents}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total students</p>
          </div>
          <div className="rounded-xl bg-pine-50 border border-pine-200 p-3 text-center">
            <p className="text-2xl font-bold text-pine-800">{promotedCount}</p>
            <p className="text-xs text-pine-700 mt-0.5 flex items-center justify-center gap-1">
              <MdCheckCircle className="h-3.5 w-3.5" /> Promoted
            </p>
          </div>
          <div className="rounded-xl bg-gold-50 border border-gold-200 p-3 text-center">
            <p className="text-2xl font-bold text-gold-700">{repeatedCount}</p>
            <p className="text-xs text-gold-700 mt-0.5 flex items-center justify-center gap-1">
              <MdWarning className="h-3.5 w-3.5" /> Repeating
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
            <p className="text-2xl font-bold text-slate-700">{graduatedCount}</p>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center justify-center gap-1">
              <MdCheckCircle className="h-3.5 w-3.5" /> Graduating
            </p>
          </div>
        </div>

        {batch.pendingCount > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
            <MdWarning className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-700">
              <strong>{batch.pendingCount}</strong> student{batch.pendingCount > 1 ? 's' : ''} had no academic
              reports and {batch.pendingCount > 1 ? 'were' : 'was'} manually reviewed. Override reasons are visible
              in the table below.
            </p>
          </div>
        )}
      </div>

      {/* ── Action buttons ── */}
      {actionError && (
        <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
          {actionError}
        </p>
      )}

      <div className="mb-5 flex gap-3">
        <Button
          variant="danger"
          onClick={() => setRejectOpen(true)}
          disabled={rejectBatch.isPending || approveBatch.isPending}
        >
          <MdThumbDown className="h-4 w-4" />
          Reject
        </Button>
        <Button
          onClick={() => setApproveConfirmOpen(true)}
          disabled={approveBatch.isPending || rejectBatch.isPending}
        >
          <MdThumbUp className="h-4 w-4" />
          Approve &amp; execute promotion
        </Button>
      </div>

      {/* ── Full roster ── */}
      <Table
        columns={columns}
        rows={batch.entries}
        getRowKey={(e) => e.id}
        emptyMessage="No entries in this batch."
      />

      {/* ── Approve confirm ── */}
      <ConfirmDialog
        isOpen={isApproveConfirmOpen}
        title="Approve and execute promotion"
        message={`This will immediately move all ${batch.totalStudents} students to their assigned classrooms. This action cannot be undone (only corrected afterwards with an audit trail). Are you sure?`}
        confirmLabel="Yes, approve and execute"
        isDangerous={false}
        isLoading={approveBatch.isPending}
        onConfirm={() => void handleApprove()}
        onCancel={() => setApproveConfirmOpen(false)}
      />

      {/* ── Reject modal ── */}
      <RejectModal
        isOpen={isRejectOpen}
        batchId={batch.id}
        isLoading={rejectBatch.isPending}
        onReject={(reason) => void handleReject(reason)}
        onClose={() => setRejectOpen(false)}
      />
    </div>
  );
}
