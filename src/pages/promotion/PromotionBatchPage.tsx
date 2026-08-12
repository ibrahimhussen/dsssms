import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MdArrowBack,
  MdCheckCircle,
  MdWarning,
  MdCancel,
  MdSchool,
  MdSend,
  MdEdit,
} from 'react-icons/md';
import { usePromotionBatch, useUpdatePromotionEntry, useBulkAssignClassroom, useSubmitPromotionBatch, useCorrectPromotionEntry } from '../../hooks/usePromotion';
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
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type {
  PromotionEntry,
  PromotionDecision,
  EligibilityStatus,
  BatchStatus,
} from '../../types/promotion';

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

function statusLabel(s: BatchStatus) {
  switch (s) {
    case 'DRAFT':     return 'Draft — being prepared';
    case 'SUBMITTED': return 'Submitted — awaiting Director approval';
    case 'APPROVED':  return 'Approved';
    case 'REJECTED':  return 'Rejected by Director';
    case 'COMPLETED': return 'Completed';
  }
}

// ── Edit entry modal ──────────────────────────────────────────────────────────

interface EditEntryModalProps {
  entry: PromotionEntry | null;
  batchId: number;
  targetAcademicYear: string;
  isGrade12: boolean;
  onClose: () => void;
}

function EditEntryModal({ entry, batchId, targetAcademicYear, isGrade12, onClose }: EditEntryModalProps) {
  const { data: classroomsData } = useClassroomOptions();
  const updateEntry = useUpdatePromotionEntry(batchId);
  const [decision, setDecision] = useState<PromotionDecision>(entry?.decision ?? 'PROMOTED');
  const [targetClassroomId, setTargetClassroomId] = useState<string>(
    entry?.targetClassroomId ? String(entry.targetClassroomId) : ''
  );
  const [overrideReason, setOverrideReason] = useState(entry?.overrideReason ?? '');
  const [error, setError] = useState<string | null>(null);

  const targetClassrooms = classroomsData?.items.filter((c) => c.academicYear === targetAcademicYear) ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry) return;
    setError(null);
    try {
      await updateEntry.mutateAsync({
        entryId: entry.id,
        input: {
          decision,
          targetClassroomId: decision !== 'GRADUATED' ? (targetClassroomId ? Number(targetClassroomId) : null) : null,
          overrideReason: overrideReason || null,
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the entry.');
    }
  }

  if (!entry) return null;

  return (
    <Modal
      title={`Edit — ${entry.studentName}`}
      isOpen={Boolean(entry)}
      onClose={onClose}
      widthClassName="max-w-[520px]"
    >
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="mb-4 rounded-lg bg-paper-50 border border-slate-200 px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Admission No.</span>
            <span className="font-mono">{entry.admissionNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Average mark</span>
            <span>{entry.averageMark !== null ? `${entry.averageMark}%` : '— (no reports)'}</span>
          </div>
          {entry.attendancePercent !== null && (
            <div className="flex justify-between">
              <span className="text-slate-500">Attendance</span>
              <span>{entry.attendancePercent}%</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Eligibility</span>
            {eligibilityBadge(entry.eligibilityStatus)}
          </div>
        </div>

        <SelectField
          label="Decision"
          value={decision}
          onChange={(e) => setDecision(e.target.value as PromotionDecision)}
        >
          <option value="PROMOTED">Promoted</option>
          <option value="REPEATED">Repeat year</option>
          {isGrade12 && <option value="GRADUATED">Graduated</option>}
        </SelectField>

        {decision !== 'GRADUATED' && (
          <SelectField
            label={decision === 'PROMOTED' ? 'Target classroom (next grade)' : 'Target classroom (same grade, new year)'}
            value={targetClassroomId}
            onChange={(e) => setTargetClassroomId(e.target.value)}
          >
            <option value="">Select a classroom for {targetAcademicYear}…</option>
            {targetClassrooms.map((c) => (
              <option key={c.classroomId} value={c.classroomId}>
                {c.className} {c.section}
              </option>
            ))}
          </SelectField>
        )}

        <TextField
          label="Override reason (optional)"
          placeholder="Explain any manual override…"
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
        />

        {error && (
          <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={updateEntry.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Bulk assign modal ─────────────────────────────────────────────────────────

interface BulkAssignModalProps {
  batchId: number;
  targetAcademicYear: string;
  isOpen: boolean;
  onClose: () => void;
}

function BulkAssignModal({ batchId, targetAcademicYear, isOpen, onClose }: BulkAssignModalProps) {
  const { data: classroomsData } = useClassroomOptions();
  const bulkAssign = useBulkAssignClassroom(batchId);
  const [targetClassroomId, setTargetClassroomId] = useState('');
  const [onlyDecision, setOnlyDecision] = useState<PromotionDecision>('PROMOTED');
  const [error, setError] = useState<string | null>(null);

  const targetClassrooms = classroomsData?.items.filter((c) => c.academicYear === targetAcademicYear) ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetClassroomId) return;
    setError(null);
    try {
      await bulkAssign.mutateAsync({ targetClassroomId: Number(targetClassroomId), onlyDecision });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign classrooms.');
    }
  }

  function handleClose() {
    setTargetClassroomId('');
    setError(null);
    onClose();
  }

  return (
    <Modal title="Bulk assign classroom" isOpen={isOpen} onClose={handleClose} widthClassName="max-w-[460px]">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <p className="mb-4 text-sm text-ink-700">
          Assign one classroom to all students with a specific decision.
        </p>

        <SelectField
          label="Apply to students with decision"
          value={onlyDecision}
          onChange={(e) => setOnlyDecision(e.target.value as PromotionDecision)}
        >
          <option value="PROMOTED">Promoted</option>
          <option value="REPEATED">Repeat year</option>
        </SelectField>

        <SelectField
          label={`Target classroom (${targetAcademicYear})`}
          value={targetClassroomId}
          onChange={(e) => setTargetClassroomId(e.target.value)}
        >
          <option value="">Select a classroom…</option>
          {targetClassrooms.map((c) => (
            <option key={c.classroomId} value={c.classroomId}>
              {c.className} {c.section}
            </option>
          ))}
        </SelectField>

        {error && (
          <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button type="submit" isLoading={bulkAssign.isPending} disabled={!targetClassroomId}>
            Assign
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Correct entry modal ───────────────────────────────────────────────────────

interface CorrectEntryModalProps {
  entry: PromotionEntry | null;
  batchId: number;
  targetAcademicYear: string;
  onClose: () => void;
}

function CorrectEntryModal({ entry, batchId, targetAcademicYear, onClose }: CorrectEntryModalProps) {
  const { data: classroomsData } = useClassroomOptions();
  const correctEntry = useCorrectPromotionEntry(batchId);
  const [targetClassroomId, setTargetClassroomId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const targetClassrooms = classroomsData?.items.filter((c) => c.academicYear === targetAcademicYear) ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry || !targetClassroomId) return;
    setError(null);
    try {
      await correctEntry.mutateAsync({ entryId: entry.id, input: { targetClassroomId: Number(targetClassroomId), notes: notes || undefined } });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply correction.');
    }
  }

  if (!entry) return null;

  return (
    <Modal title={`Correct — ${entry.studentName}`} isOpen={Boolean(entry)} onClose={onClose} widthClassName="max-w-[480px]">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
          This will move <strong>{entry.studentName}</strong> to a different classroom.
          The previous enrollment record will be marked as corrected and a new one created.
          This action is recorded in the audit log.
        </p>

        <SelectField
          label={`Correct target classroom (${targetAcademicYear})`}
          value={targetClassroomId}
          onChange={(e) => setTargetClassroomId(e.target.value)}
        >
          <option value="">Select correct classroom…</option>
          {targetClassrooms.map((c) => (
            <option key={c.classroomId} value={c.classroomId}>
              {c.className} {c.section}
            </option>
          ))}
        </SelectField>

        <TextField
          label="Reason for correction (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && (
          <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={correctEntry.isPending} disabled={!targetClassroomId}>
            Apply correction
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PromotionBatchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const batchId = id ? Number(id) : null;

  const { data: batch, isLoading } = usePromotionBatch(batchId);
  const submitBatch = useSubmitPromotionBatch();

  const [editEntry, setEditEntry] = useState<PromotionEntry | null>(null);
  const [correctEntryTarget, setCorrectEntryTarget] = useState<PromotionEntry | null>(null);
  const [isBulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [isSubmitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canEdit = (user?.role === 'DIRECTOR' || user?.role === 'VICE_DIRECTOR') && batch?.status === 'DRAFT';
  const canSubmit = canEdit && (batch?.entries.every((e) => e.decision === 'GRADUATED' || e.targetClassroomId !== null) ?? false);
  const canCorrect = (user?.role === 'DIRECTOR' || user?.role === 'ADMIN') && batch?.status === 'COMPLETED';

  const isGrade12 = batch
    ? batch.sourceClassroomLabel.toLowerCase().includes('grade 12') || batch.sourceClassroomLabel.trim().startsWith('12 ')
    : false;

  async function handleSubmit() {
    if (!batchId) return;
    setSubmitError(null);
    try {
      await submitBatch.mutateAsync(batchId);
      setSubmitConfirmOpen(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit the batch.');
      setSubmitConfirmOpen(false);
    }
  }

  if (isLoading || !batch) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <span className="mr-2 inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700" />
        Loading promotion batch…
      </div>
    );
  }

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
    {
      header: 'Attendance',
      render: (e) =>
        e.attendancePercent !== null ? (
          <span className="font-mono text-sm">{e.attendancePercent}%</span>
        ) : (
          <span className="text-slate-400 text-sm">—</span>
        ),
    },
    { header: 'Eligibility', render: (e) => eligibilityBadge(e.eligibilityStatus) },
    { header: 'Decision', render: (e) => decisionBadge(e.decision) },
    {
      header: 'Target classroom',
      render: (e) =>
        e.decision === 'GRADUATED' ? (
          <Badge tone="positive">Graduated</Badge>
        ) : e.targetClassroomLabel ? (
          <span className="text-sm">{e.targetClassroomLabel}</span>
        ) : (
          <span className="text-danger-600 text-sm font-medium">⚠ Not assigned</span>
        ),
    },
    {
      header: 'Actions',
      render: (e) => (
        <div className="flex gap-1">
          {canEdit && (
            <Button variant="ghost" onClick={() => setEditEntry(e)}>
              <MdEdit className="h-4 w-4" />
              Edit
            </Button>
          )}
          {canCorrect && (
            <Button variant="ghost" onClick={() => setCorrectEntryTarget(e)}>
              Correct
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-full">
      {/* ── Header ── */}
      <div className="mb-1 flex items-center gap-3">
        <button
          onClick={() => navigate('/promotion')}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-paper-100"
          aria-label="Back to promotion list"
        >
          <MdArrowBack className="h-5 w-5" />
        </button>
        <h1 className="text-2xl">Promotion batch</h1>
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
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Status</p>
          <p className="font-semibold text-ink-900">{statusLabel(batch.status)}</p>
        </div>
      </div>

      {/* ── Eligibility summary ── */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-pine-200 bg-pine-50 px-4 py-2.5">
          <MdCheckCircle className="h-5 w-5 text-pine-700" />
          <span className="text-sm font-semibold text-pine-800">{batch.eligibleCount} eligible</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-gold-200 bg-gold-50 px-4 py-2.5">
          <MdWarning className="h-5 w-5 text-gold-600" />
          <span className="text-sm font-semibold text-gold-700">{batch.pendingCount} pending review</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-danger-200 bg-danger-50 px-4 py-2.5">
          <MdCancel className="h-5 w-5 text-danger-600" />
          <span className="text-sm font-semibold text-danger-700">{batch.notEligibleCount} not eligible</span>
        </div>
        {isGrade12 && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
            <MdSchool className="h-5 w-5 text-slate-600" />
            <span className="text-sm font-semibold text-slate-700">Grade 12 — graduation year</span>
          </div>
        )}
      </div>

      {/* ── Rejection notice ── */}
      {batch.status === 'REJECTED' && batch.rejectionReason && (
        <div className="mb-5 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3">
          <p className="text-sm font-semibold text-danger-700">Rejected by Director</p>
          <p className="mt-0.5 text-sm text-danger-600">{batch.rejectionReason}</p>
        </div>
      )}

      {/* ── Action bar ── */}
      {(canEdit || batch.status === 'SUBMITTED') && (
        <div className="mb-5 flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="secondary" onClick={() => setBulkAssignOpen(true)}>
              Bulk assign classroom
            </Button>
          )}
          {canEdit && (
            <Button
              onClick={() => setSubmitConfirmOpen(true)}
              disabled={!canSubmit}
              title={canSubmit ? undefined : 'All students with PROMOTED or REPEATED decision must have a target classroom assigned'}
            >
              <MdSend className="h-4 w-4" />
              Submit for approval
            </Button>
          )}
          {batch.status === 'SUBMITTED' && user?.role === 'DIRECTOR' && (
            <Button variant="secondary" onClick={() => navigate(`/promotion/${batch.id}/approve`)}>
              Review &amp; approve
            </Button>
          )}
        </div>
      )}

      {submitError && (
        <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
          {submitError}
        </p>
      )}

      {/* ── Roster table ── */}
      <Table
        columns={columns}
        rows={batch.entries}
        getRowKey={(e) => e.id}
        emptyMessage="No students in this batch."
      />

      {/* ── Modals ── */}
      <EditEntryModal
        entry={editEntry}
        batchId={batch.id}
        targetAcademicYear={batch.targetAcademicYear}
        isGrade12={isGrade12}
        onClose={() => setEditEntry(null)}
      />

      <BulkAssignModal
        batchId={batch.id}
        targetAcademicYear={batch.targetAcademicYear}
        isOpen={isBulkAssignOpen}
        onClose={() => setBulkAssignOpen(false)}
      />

      <CorrectEntryModal
        entry={correctEntryTarget}
        batchId={batch.id}
        targetAcademicYear={batch.targetAcademicYear}
        onClose={() => setCorrectEntryTarget(null)}
      />

      <ConfirmDialog
        isOpen={isSubmitConfirmOpen}
        title="Submit for Director approval"
        message={`You are about to submit this promotion batch (${batch.totalStudents} students) for Director approval. Once submitted, no further changes can be made without rejection and re-preparation.`}
        confirmLabel="Submit"
        isDangerous={false}
        isLoading={submitBatch.isPending}
        onConfirm={() => void handleSubmit()}
        onCancel={() => setSubmitConfirmOpen(false)}
      />
    </div>
  );
}
