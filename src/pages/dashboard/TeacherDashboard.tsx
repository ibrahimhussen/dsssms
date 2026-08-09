import { Link } from 'react-router-dom';
import { useMyClassrooms } from '../../hooks/useMyClassrooms';
import {
  useMyTeachingAssignments,
  useTeacherAttendanceSummary,
  useTeacherGradeDistribution,
  useTodaysAttendanceStatus,
} from '../../hooks/useDashboardData';
import { useMyInbox } from '../../hooks/useNotifications';
import { Card, StatCard } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { BarChart, DonutChart } from '../../components/ui/Charts';
import { chartColors } from '../../components/ui/chart-colors';

const STATUS_COLORS: Record<string, string> = {
  PRESENT: chartColors.pine,
  ABSENT: chartColors.danger,
  LATE: chartColors.gold,
  EXCUSED: chartColors.slate,
};

export function TeacherDashboard() {
  const { data: classrooms, isLoading: isClassroomsLoading } = useMyClassrooms();
  const classroomIds = classrooms?.map((c) => c.classroomId) ?? [];
  const { pendingCount, isLoading: isAttendanceStatusLoading } = useTodaysAttendanceStatus(classroomIds);
  const { data: inbox, isLoading: isInboxLoading } = useMyInbox({ page: 1, limit: 3 });
  const { data: assignments } = useMyTeachingAssignments();
  const { counts: attendanceCounts, isLoading: isAttendanceSummaryLoading } = useTeacherAttendanceSummary(classroomIds);
  const { buckets: gradeBuckets, isLoading: isGradeDistributionLoading } = useTeacherGradeDistribution(assignments);

  const totalStudents = classrooms?.reduce((sum, c) => sum + c.studentCount, 0) ?? 0;
  const totalSubjectAssignments = classrooms?.reduce((sum, c) => sum + c.subjects.length, 0) ?? 0;

  if (!isClassroomsLoading && (!classrooms || classrooms.length === 0)) {
    return (
      <Card>
        <EmptyState
          title="No teaching assignments yet"
          description="An administrator hasn't assigned you to any subject or classroom yet."
        />
      </Card>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link to="/attendance">
          <Button>Take today's attendance</Button>
        </Link>
        <Link to="/grades">
          <Button variant="secondary">Enter grades</Button>
        </Link>
        <Link to="/my-classes">
          <Button variant="ghost">View my classes</Button>
        </Link>
      </div>

      <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <StatCard label="Classes assigned" value={isClassroomsLoading ? '—' : classrooms?.length ?? 0} />
        <StatCard label="Students taught" value={isClassroomsLoading ? '—' : totalStudents} />
        <StatCard label="Subjects taught" value={isClassroomsLoading ? '—' : totalSubjectAssignments} />
        <StatCard
          label="Pending: attendance today"
          value={isClassroomsLoading || isAttendanceStatusLoading ? '—' : pendingCount}
        />
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-5 max-[900px]:grid-cols-1">
        <Card>
          <h2 className="mb-3 text-lg">Your classes</h2>
          <ul className="flex flex-col gap-2">
            {classrooms?.map((c) => (
              <li
                key={c.classroomId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3"
              >
                <div>
                  <span className="text-sm font-semibold text-ink-900">
                    {c.className} {c.section} · {c.academicYear}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {c.subjects.map((s) => (
                      <Badge key={s.subjectId}>{s.subjectName}</Badge>
                    ))}
                  </div>
                </div>
                <span className="text-sm text-slate-500">{c.studentCount} student(s)</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg">Notice board</h2>
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

      <div className="mt-5 grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        <Card>
          <h2 className="mb-4 text-lg">Attendance summary (today)</h2>
          {isAttendanceSummaryLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <DonutChart
              data={[
                { label: 'Present', value: attendanceCounts.PRESENT, color: STATUS_COLORS.PRESENT },
                { label: 'Absent', value: attendanceCounts.ABSENT, color: STATUS_COLORS.ABSENT },
                { label: 'Late', value: attendanceCounts.LATE, color: STATUS_COLORS.LATE },
                { label: 'Excused', value: attendanceCounts.EXCUSED, color: STATUS_COLORS.EXCUSED },
              ]}
              emptyLabel="No attendance taken today yet"
            />
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg">Grade distribution</h2>
          {isGradeDistributionLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <BarChart data={gradeBuckets} color={chartColors.gold} emptyLabel="No grades entered yet" />
          )}
        </Card>
      </div>
    </>
  );
}
