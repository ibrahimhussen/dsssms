import { useState } from 'react';
import { useMyHomeworkAsTeacher, useDeleteHomework } from '../../hooks/useHomework';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import { CreateHomeworkModal } from './CreateHomeworkModal';
import { HomeworkSubmissionsModal } from './HomeworkSubmissionsModal';

export function TeacherHomeworkPage() {
  const { data: assignments, isLoading } = useMyHomeworkAsTeacher();
  const deleteHomework = useDeleteHomework();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [openAssignmentId, setOpenAssignmentId] = useState<number | null>(null);

  const openAssignment = assignments?.find((a) => a.assignmentId === openAssignmentId);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(assignmentId: number) {
    if (!window.confirm('Remove this assignment and all of its submission records?')) return;
    setDeleteError(null);
    try {
      await deleteHomework.mutateAsync(assignmentId);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this assignment.');
    }
  }

  return (
    <div className="max-w-full">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl">Assignments &amp; homework</h1>
        <Button onClick={() => setIsCreateOpen(true)}>New assignment</Button>
      </div>
      <LedgerRule />

      {deleteError && (
        <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
          {deleteError}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !assignments || assignments.length === 0 ? (
        <EmptyState title="No assignments yet" description="Create your first assignment to see it here." />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {assignments.map((a) => (
            <Card key={a.assignmentId}>
              <p className="mb-1 font-display text-lg font-semibold text-ink-900">{a.title}</p>
              <p className="mb-2 text-[0.8125rem] text-slate-500">
                {a.teacherSubject.subject.subjectName} · {a.teacherSubject.classroom.className}{' '}
                {a.teacherSubject.classroom.section} · Due {new Date(a.dueDate).toLocaleDateString()}
              </p>
              {a.description && <p className="mb-3 text-sm text-ink-700">{a.description}</p>}

              <div className="mb-3 flex flex-wrap gap-1.5">
                <Badge tone="positive">{a.submissionSummary.submitted} submitted</Badge>
                <Badge tone="warning">{a.submissionSummary.late} late</Badge>
                <Badge tone="danger">{a.submissionSummary.notSubmitted} not submitted</Badge>
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setOpenAssignmentId(a.assignmentId)}>
                  View submissions
                </Button>
                <Button variant="danger" onClick={() => void handleDelete(a.assignmentId)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateHomeworkModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <HomeworkSubmissionsModal
        assignmentId={openAssignmentId}
        assignmentTitle={openAssignment?.title}
        onClose={() => setOpenAssignmentId(null)}
      />
    </div>
  );
}
