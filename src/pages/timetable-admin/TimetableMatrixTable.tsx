import { useMemo } from 'react';
import type { DayOfWeek, TimetableEntry } from '../../types/timetable';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export interface StandardPeriod {
  id: string;
  name: string;
  localTime: string;
  session: 'Morning' | 'Afternoon' | 'Break';
  startTime: string;
  endTime: string;
}

export const DEFAULT_PERIODS: StandardPeriod[] = [
  // Morning Session: 2:00 – 6:15 Local (08:00 – 12:15)
  // 3 Periods Before Rest + 15 min Rest Break (4:00-4:15 Local) + 3 Periods After Rest
  { id: 'm-p1', name: 'Period 1', localTime: '2:00 – 2:40', session: 'Morning', startTime: '08:00', endTime: '08:40' },
  { id: 'm-p2', name: 'Period 2', localTime: '2:40 – 3:20', session: 'Morning', startTime: '08:40', endTime: '09:20' },
  { id: 'm-p3', name: 'Period 3', localTime: '3:20 – 4:00', session: 'Morning', startTime: '09:20', endTime: '10:00' },
  { id: 'm-mb', name: '☕ Rest', localTime: '4:00 – 4:15', session: 'Break', startTime: '10:00', endTime: '10:15' },
  { id: 'm-p4', name: 'Period 4', localTime: '4:15 – 4:55', session: 'Morning', startTime: '10:15', endTime: '10:55' },
  { id: 'm-p5', name: 'Period 5', localTime: '4:55 – 5:35', session: 'Morning', startTime: '10:55', endTime: '11:35' },
  { id: 'm-p6', name: 'Period 6', localTime: '5:35 – 6:15', session: 'Morning', startTime: '11:35', endTime: '12:15' },

  // Afternoon Session: 6:30 – 10:45 Local (12:30 – 16:45)
  // 3 Periods Before Rest + 15 min Rest Break (8:30-8:45 Local) + 3 Periods After Rest
  { id: 'a-p1', name: 'Period 1', localTime: '6:30 – 7:10', session: 'Afternoon', startTime: '12:30', endTime: '13:10' },
  { id: 'a-p2', name: 'Period 2', localTime: '7:10 – 7:50', session: 'Afternoon', startTime: '13:10', endTime: '13:50' },
  { id: 'a-p3', name: 'Period 3', localTime: '7:50 – 8:30', session: 'Afternoon', startTime: '13:50', endTime: '14:30' },
  { id: 'a-ab', name: '☕ Rest', localTime: '8:30 – 8:45', session: 'Break', startTime: '14:30', endTime: '14:45' },
  { id: 'a-p4', name: 'Period 4', localTime: '8:45 – 9:25', session: 'Afternoon', startTime: '14:45', endTime: '15:25' },
  { id: 'a-p5', name: 'Period 5', localTime: '9:25 – 10:05', session: 'Afternoon', startTime: '15:25', endTime: '16:05' },
  { id: 'a-p6', name: 'Period 6', localTime: '10:05 – 10:45', session: 'Afternoon', startTime: '16:05', endTime: '16:45' },
];

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
};

interface TimetableMatrixTableProps {
  entries: TimetableEntry[];
  sessionFilter?: 'MORNING' | 'AFTERNOON';
  isEditable?: boolean;
  onFillSlot?: (day: DayOfWeek, startTime: string, endTime: string) => void;
  onDeleteSlot?: (entry: TimetableEntry) => void;
  isTeacherView?: boolean;
}

export function TimetableMatrixTable({
  entries,
  sessionFilter,
  isEditable = false,
  onFillSlot,
  onDeleteSlot,
  isTeacherView = false,
}: TimetableMatrixTableProps) {
  // Build time periods combining default periods and any custom entry times
  const periods = useMemo(() => {
    // Start from the session-filtered default periods
    const basePeriods = sessionFilter
      ? DEFAULT_PERIODS.filter((p) => p.session === 'Break' ? p.id.startsWith(sessionFilter === 'MORNING' ? 'm-' : 'a-') : p.session === sessionFilter)
      : DEFAULT_PERIODS;

    const periodList = [...basePeriods];

    for (const e of entries) {
      const exists = periodList.some((p) => p.startTime === e.startTime && p.endTime === e.endTime);
      if (!exists) {
        const entrySession = e.startTime < '12:30' ? 'Morning' : 'Afternoon';
        // Only add custom period if it matches session filter
        if (!sessionFilter || entrySession.toUpperCase() === sessionFilter) {
          periodList.push({
            id: `custom-${e.startTime}-${e.endTime}`,
            name: `${e.startTime} - ${e.endTime}`,
            localTime: `${e.startTime} – ${e.endTime}`,
            session: entrySession as 'Morning' | 'Afternoon',
            startTime: e.startTime,
            endTime: e.endTime,
          });
        }
      }
    }

    return periodList.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [entries, sessionFilter]);

  const morningCount = periods.filter((p) => p.session === 'Morning' || p.id === 'm-mb').length;
  const afternoonCount = periods.filter((p) => p.session === 'Afternoon' || p.id === 'a-ab').length;

  // Lookup map: `${day}_${startTime}_${endTime}` -> TimetableEntry
  const entryMap = useMemo(() => {
    const map = new Map<string, TimetableEntry>();
    for (const e of entries) {
      map.set(`${e.dayOfWeek}_${e.startTime}_${e.endTime}`, e);
    }
    return map;
  }, [entries]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100 text-xs uppercase tracking-wider text-slate-600 font-semibold">
            <th className="w-28 border-r border-slate-200 p-2.5">Session</th>
            {morningCount > 0 && (
              <th colSpan={morningCount} className="border-r border-slate-200 bg-amber-50/90 p-2.5 text-center text-amber-900 font-semibold">
                ☀️ Morning Session (6 Periods: 2:00 – 6:15 Local / Rest 4:00–4:15)
              </th>
            )}
            {afternoonCount > 0 && (
              <th colSpan={afternoonCount} className="p-2.5 bg-indigo-50/90 text-center text-indigo-900 font-semibold">
                🌤️ Afternoon Session (6 Periods: 6:30 – 10:45 Local / Rest 8:30–8:45)
              </th>
            )}
          </tr>
          <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
            <th className="w-28 border-r border-slate-200 p-3 font-semibold text-ink-900">Day / Time</th>
            {periods.map((p) => (
              <th
                key={p.id}
                className={`border-r border-slate-200 p-2.5 text-center last:border-r-0 ${
                  p.session === 'Break' ? 'bg-amber-100/50 min-w-[90px]' : ''
                }`}
              >
                <div className="font-semibold text-ink-900">{p.name}</div>
                <div className="text-[0.75rem] font-medium text-emerald-800">{p.localTime}</div>
                <div className="text-[0.6875rem] text-slate-500 font-mono">({p.startTime}–{p.endTime})</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {DAYS.map((day) => (
            <tr key={day} className="hover:bg-slate-50/50 transition-colors">
              <td className="border-r border-slate-200 bg-slate-50/75 p-3 font-semibold text-ink-900">
                {DAY_LABELS[day]}
              </td>
              {periods.map((p) => {
                if (p.session === 'Break') {
                  return (
                    <td key={p.id} className="border-r border-slate-200 bg-amber-50/40 p-2 text-center align-middle text-[0.75rem] text-amber-900 font-medium select-none">
                      ☕ Rest Break
                    </td>
                  );
                }

                const entry = entryMap.get(`${day}_${p.startTime}_${p.endTime}`);

                return (
                  <td key={p.id} className="border-r border-slate-200 p-2 align-top last:border-r-0 min-w-[130px]">
                    {entry ? (
                      <div className="group relative flex flex-col justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 transition-all hover:border-emerald-300 hover:shadow-sm">
                        <div>
                          <div className="mb-1 flex items-center justify-between gap-1">
                            <span className="font-semibold text-emerald-950 text-xs truncate" title={entry.teacherSubject.subject.subjectName}>
                              {entry.teacherSubject.subject.subjectName}
                            </span>
                            {entry.roomNumber && (
                              <Badge className="text-[0.65rem] px-1.5 py-0.2 bg-emerald-100 text-emerald-800">
                                {entry.roomNumber}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[0.75rem] text-emerald-800/80 leading-snug">
                            {isTeacherView
                              ? `${entry.teacherSubject.classroom.className} — Sec ${entry.teacherSubject.classroom.section}`
                              : `${entry.teacherSubject.teacher.firstName} ${entry.teacherSubject.teacher.lastName}`}
                          </p>
                          {!isTeacherView && (
                            <span className="inline-block mt-0.5 text-[0.6875rem] font-semibold text-emerald-700/80">
                              Sec {entry.teacherSubject.classroom.section}
                            </span>
                          )}
                        </div>

                        {isEditable && onDeleteSlot && (
                          <div className="mt-2 flex justify-end opacity-90 group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => onDeleteSlot(entry)}
                              className="text-[0.7rem] text-rose-600 hover:text-rose-800 underline font-medium cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ) : isEditable ? (
                      <button
                        type="button"
                        onClick={() => onFillSlot?.(day, p.startTime, p.endTime)}
                        className="group flex h-full min-h-[64px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-2 text-slate-400 transition-all hover:border-emerald-400 hover:bg-emerald-50/30 hover:text-emerald-600 cursor-pointer"
                        title={`Fill timetable slot for ${DAY_LABELS[day]} (${p.name}: ${p.localTime})`}
                      >
                        <span className="text-lg leading-none transition-transform group-hover:scale-110">+</span>
                        <span className="text-[0.7rem] font-medium mt-0.5">Fill slot</span>
                      </button>
                    ) : (
                      <div className="flex min-h-[64px] items-center justify-center text-[0.75rem] text-slate-300">
                        —
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
