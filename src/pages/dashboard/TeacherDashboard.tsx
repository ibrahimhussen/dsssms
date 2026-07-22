import { useMyTeachingAssignments } from '../../hooks/useDashboardData';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';

export function TeacherDashboard() {
  const { data: assignments, isLoading } = useMyTeachingAssignments();

  return (
    <Card>
      <h2 className="mb-3 text-lg">Your teaching assignments</h2>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !assignments || assignments.length === 0 ? (
        <EmptyState
          title="No teaching assignments yet"
          description="An administrator hasn't assigned you to any subject or classroom yet."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {assignments.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
              <span className="text-sm font-semibold text-ink-900">
                {a.subject.subjectName} ({a.subject.subjectCode})
              </span>
              <span className="text-sm text-slate-500">
                {a.classroom.className} {a.classroom.section} · {a.classroom.academicYear}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
