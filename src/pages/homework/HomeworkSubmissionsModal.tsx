import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useHomeworkSubmissions, useUpdateHomeworkSubmissionStatus } from '../../hooks/useHomework';
import type { HomeworkSubmissionStatus } from '../../types/homework';

const STATUS_OPTIONS: { value: HomeworkSubmissionStatus; label: string }[] = [
  { value: 'NOT_SUBMITTED', label: 'Not submitted' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'LATE', label: 'Late' },
];

const STATUS_TONE: Record<HomeworkSubmissionStatus, 'positive' | 'danger' | 'warning'> = {
  SUBMITTED: 'positive',
  LATE: 'warning',
  NOT_SUBMITTED: 'danger',
};

interface HomeworkSubmissionsModalProps {
  assignmentId: number | null;
  assignmentTitle?: string;
  onClose: () => void;
}

export function HomeworkSubmissionsModal({ assignmentId, assignmentTitle, onClose }: HomeworkSubmissionsModalProps) {
  const { data: submissions, isLoading } = useHomeworkSubmissions(assignmentId ?? undefined);
  const updateStatus = useUpdateHomeworkSubmissionStatus();

  return (
    <Modal
      title={assignmentTitle ? `Submissions — ${assignmentTitle}` : 'Submissions'}
      isOpen={Boolean(assignmentId)}
      onClose={onClose}
      widthClassName="max-w-[560px]"
    >
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !submissions || submissions.length === 0 ? (
        <p className="text-sm text-slate-500">No students enrolled in this classroom yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {submissions.map((s) => (
            <li
              key={s.submissionId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-paper-100 px-3 py-2.5"
            >
              <div>
                <span className="text-sm font-semibold text-ink-900">
                  {s.student.firstName} {s.student.lastName}
                </span>{' '}
                <span className="font-mono text-xs text-slate-500">({s.student.admissionNumber})</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[s.status]}>{STATUS_OPTIONS.find((o) => o.value === s.status)?.label}</Badge>
                <select
                  value={s.status}
                  onChange={(e) =>
                    assignmentId &&
                    updateStatus.mutate({
                      assignmentId,
                      studentId: s.student.studentId,
                      input: { status: e.target.value as HomeworkSubmissionStatus },
                    })
                  }
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
