import { useMyParentProfile } from '../../hooks/useDashboardData';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';

export function ParentDashboard() {
  const { data, isLoading } = useMyParentProfile();

  return (
    <Card>
      <h2 className="mb-3 text-lg">Your children</h2>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !data || data.children.length === 0 ? (
        <EmptyState title="No linked students" description="Contact the school administrator if this seems wrong." />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.children.map((child) => (
            <li key={child.studentId} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
              <span className="text-sm font-semibold text-ink-900">
                {child.firstName} {child.lastName}
              </span>
              <span className="font-mono text-[0.8125rem] text-slate-500">{child.admissionNumber}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
