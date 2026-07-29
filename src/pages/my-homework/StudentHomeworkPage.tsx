import { useState } from 'react';
import { useMyHomeworkAsStudent, useMarkMyHomeworkSubmission } from '../../hooks/useHomework';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import type { HomeworkSubmissionStatus } from '../../types/homework';

const STATUS_LABELS: Record<HomeworkSubmissionStatus, string> = {
  NOT_SUBMITTED: 'Not submitted',
  SUBMITTED: 'Submitted',
  LATE: 'Submitted late',
};

const STATUS_TONE: Record<HomeworkSubmissionStatus, 'positive' | 'danger' | 'warning'> = {
  SUBMITTED: 'positive',
  LATE: 'warning',
  NOT_SUBMITTED: 'danger',
};

export function StudentHomeworkPage() {
  const { data: assignments, isLoading } = useMyHomeworkAsStudent();
  const markMySubmission = useMarkMyHomeworkSubmission();
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function toggle(assignmentId: number, currentlyDone: boolean) {
    setPendingId(assignmentId);
    try {
      await markMySubmission.mutateAsync({ assignmentId, input: { submitted: !currentlyDone } });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Assignments &amp; homework</h1>
      <LedgerRule />

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !assignments || assignments.length === 0 ? (
        <EmptyState title="No assignments yet" description="Your teachers haven't set any homework yet." />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {assignments.map((a) => {
            const isDone = a.mySubmission.status !== 'NOT_SUBMITTED';
            const isOverdue = !isDone && new Date(a.dueDate) < new Date();

            return (
              <Card key={a.assignmentId}>
                <p className="font-display text-lg font-semibold text-ink-900">{a.title}</p>
                <p className="mb-2 text-[0.8125rem] text-slate-500">
                  {a.teacherSubject.subject.subjectName} · {a.teacherSubject.teacher.firstName}{' '}
                  {a.teacherSubject.teacher.lastName}
                </p>
                {a.description && <p className="mb-3 text-sm text-ink-700">{a.description}</p>}

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[a.mySubmission.status]}>{STATUS_LABELS[a.mySubmission.status]}</Badge>
                  {isOverdue && <Badge tone="danger">Overdue</Badge>}
                  <span className="text-[0.8125rem] text-slate-500">
                    Due {new Date(a.dueDate).toLocaleDateString()}
                  </span>
                </div>

                <Button
                  variant={isDone ? 'ghost' : 'primary'}
                  isLoading={pendingId === a.assignmentId}
                  onClick={() => void toggle(a.assignmentId, isDone)}
                >
                  {isDone ? 'Mark as not done' : 'Mark as done'}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
