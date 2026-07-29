import { useAuth } from '../../context/AuthContext';
import { useMyTimetable } from '../../hooks/useTimetable';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import type { DayOfWeek, TimetableEntry } from '../../types/timetable';

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
};

export function TimetablePage() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';
  const { data: entries, isLoading } = useMyTimetable();

  const byDay = new Map<DayOfWeek, TimetableEntry[]>();
  for (const e of entries ?? []) {
    const list = byDay.get(e.dayOfWeek) ?? [];
    list.push(e);
    byDay.set(e.dayOfWeek, list);
  }

  const activeDays = DAYS.filter((d) => (byDay.get(d)?.length ?? 0) > 0);

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">{isTeacher ? 'Class timetable' : 'My timetable'}</h1>
      <LedgerRule />

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : activeDays.length === 0 ? (
        <EmptyState
          title="No schedule yet"
          description="An administrator hasn't set up a weekly timetable for your classes yet."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {activeDays.map((day) => (
            <Card key={day}>
              <h2 className="mb-3 text-lg">{DAY_LABELS[day]}</h2>
              <ul className="flex flex-col gap-2.5">
                {byDay
                  .get(day)!
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((e) => (
                    <li key={e.timetableEntryId} className="rounded-lg border border-paper-100 px-3 py-2.5">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink-900">
                          {e.startTime} – {e.endTime}
                        </span>
                        {e.roomNumber && <Badge>{e.roomNumber}</Badge>}
                      </div>
                      <p className="text-[0.8125rem] text-slate-500">
                        {e.teacherSubject.subject.subjectName}
                        {isTeacher
                          ? ` · ${e.teacherSubject.classroom.className} ${e.teacherSubject.classroom.section}`
                          : ` · ${e.teacherSubject.teacher.firstName} ${e.teacherSubject.teacher.lastName}`}
                      </p>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
