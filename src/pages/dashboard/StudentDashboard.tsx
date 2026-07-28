import { Link } from 'react-router-dom';
import { useMyAttendanceSummary } from '../../hooks/useDashboardData';
import { useMyAcademicReports } from '../../hooks/useAcademicReports';
import { useMyInbox } from '../../hooks/useNotifications';
import { Card, StatCard } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

export function StudentDashboard() {
  const { data, isLoading } = useMyAttendanceSummary();
  const { data: reports, isLoading: isReportsLoading } = useMyAcademicReports();
  const { data: inbox, isLoading: isInboxLoading } = useMyInbox({ page: 1, limit: 3 });

  const latestReport = reports
    ? [...reports].sort((a, b) => b.generatedDate.localeCompare(a.generatedDate))[0]
    : undefined;

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link to="/my-grades">
          <Button>View my grades</Button>
        </Link>
        <Link to="/my-attendance">
          <Button variant="secondary">View my attendance</Button>
        </Link>
        <Link to="/notifications">
          <Button variant="ghost">Notifications</Button>
        </Link>
      </div>

      <h2 className="mb-3 text-lg">Your attendance</h2>
      <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
        <StatCard label="Present" value={isLoading ? '—' : data?.present} />
        <StatCard label="Absent" value={isLoading ? '—' : data?.absent} />
        <StatCard label="Late" value={isLoading ? '—' : data?.late} />
        <StatCard label="Excused" value={isLoading ? '—' : data?.excused} />
        <StatCard label="Attendance rate" value={isLoading ? '—' : `${data?.presentPercentage ?? 0}%`} />
      </div>

      <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        <Card>
          <h2 className="mb-3 text-lg">Latest report card</h2>
          {isReportsLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !latestReport ? (
            <EmptyState
              title="No report card yet"
              description="Your school will generate this once grades for the semester are finalized."
            />
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-slate-500">
                {latestReport.semester === 'SEMESTER_1' ? 'Semester 1' : 'Semester 2'} · {latestReport.academicYear}
              </span>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl font-semibold text-pine-900">{latestReport.averageMark}%</span>
                {latestReport.rank && <Badge tone="positive">Rank #{latestReport.rank}</Badge>}
              </div>
              <Link to="/my-grades" className="text-[0.8125rem] font-semibold text-pine-700 hover:underline">
                View all grades &amp; report cards
              </Link>
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg">Announcements &amp; messages</h2>
            <Link to="/notifications" className="text-[0.8125rem] font-semibold text-pine-700 hover:underline">
              View all
            </Link>
          </div>

          {isInboxLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !inbox || inbox.items.length === 0 ? (
            <EmptyState title="No notifications" description="You're all caught up." />
          ) : (
            <ul className="flex flex-col gap-3">
              {inbox.items.map((n) => (
                <li key={n.notificationId} className="rounded-lg border border-paper-100 px-3 py-2.5">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink-900">{n.title}</span>
                    {n.status === 'UNREAD' && <Badge tone="warning">New</Badge>}
                  </div>
                  <p className="line-clamp-2 text-[0.8125rem] text-slate-500">{n.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
