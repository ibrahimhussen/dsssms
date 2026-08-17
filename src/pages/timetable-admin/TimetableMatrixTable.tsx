import { useMemo } from 'react';
import type { DayOfWeek, TimetableEntry } from '../../types/timetable';
import { MORNING_PERIODS, AFTERNOON_PERIODS, type TimetablePeriod } from '../../lib/timetable-periods';
import { Badge } from '../../components/ui/Badge';

// Re-export for callers that previously imported DEFAULT_PERIODS from here
export type { TimetablePeriod as StandardPeriod };
export const DEFAULT_PERIODS = [...MORNING_PERIODS, ...AFTERNOON_PERIODS];

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY:    'Monday',
  TUESDAY:   'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY:  'Thursday',
  FRIDAY:    'Friday',
  SATURDAY:  'Saturday',
};

export type SessionFilter = 'MORNING' | 'AFTERNOON';

interface TimetableMatrixTableProps {
  entries: TimetableEntry[];
  sessionFilter?: SessionFilter;
  isEditable?: boolean;
  onFillSlot?: (day: DayOfWeek, startTime: string, endTime: string, periodNumber: number) => void;
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
  // Determine which periods to show based on session filter
  const periods = useMemo<TimetablePeriod[]>(() => {
    if (sessionFilter === 'MORNING')   return MORNING_PERIODS;
    if (sessionFilter === 'AFTERNOON') return AFTERNOON_PERIODS;
    // No filter — show both sessions (admin overview without session selected)
    return [...MORNING_PERIODS, ...AFTERNOON_PERIODS];
  }, [sessionFilter]);

  // Lookup map: `${day}_${startTime}_${endTime}` → TimetableEntry
  const entryMap = useMemo(() => {
    const map = new Map<string, TimetableEntry>();
    for (const e of entries) {
      map.set(`${e.dayOfWeek}_${e.startTime}_${e.endTime}`, e);
    }
    return map;
  }, [entries]);

  const morningPeriods   = periods.filter((p) => p.session === 'Morning' || (p.isBreak && p.id.startsWith('m-')));
  const afternoonPeriods = periods.filter((p) => p.session === 'Afternoon' || (p.isBreak && p.id.startsWith('a-')));
  const showMorning   = morningPeriods.length > 0;
  const showAfternoon = afternoonPeriods.length > 0;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead>
          {/* Session header row */}
          <tr className="border-b border-slate-200 bg-slate-100 text-xs uppercase tracking-wider text-slate-600 font-semibold">
            <th className="w-28 border-r border-slate-200 p-2.5" />
            {showMorning && (
              <th
                colSpan={morningPeriods.length}
                className="border-r border-slate-200 bg-amber-50 p-2.5 text-center text-amber-900 font-semibold"
              >
                ☀️ Morning Session &nbsp;·&nbsp; 02:00 – 06:15 &nbsp;·&nbsp; Break 04:00 – 04:15
              </th>
            )}
            {showAfternoon && (
              <th
                colSpan={afternoonPeriods.length}
                className="p-2.5 bg-indigo-50 text-center text-indigo-900 font-semibold"
              >
                🌤️ Afternoon Session &nbsp;·&nbsp; 06:30 – 10:45 &nbsp;·&nbsp; Break 08:30 – 08:45
              </th>
            )}
          </tr>

          {/* Period header row */}
          <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
            <th className="w-28 border-r border-slate-200 p-3 font-semibold text-ink-900">Day</th>
            {periods.map((p) => (
              <th
                key={p.id}
                className={[
                  'border-r border-slate-200 p-2.5 text-center last:border-r-0 min-w-[110px]',
                  p.isBreak ? 'bg-amber-100/60 min-w-[80px]' : '',
                ].join(' ')}
              >
                {p.isBreak ? (
                  <div>
                    <div className="font-semibold text-amber-800 text-xs">☕ Break</div>
                    <div className="text-[0.75rem] font-medium text-amber-700">{p.localTime}</div>
                  </div>
                ) : (
                  <div>
                    <div className="font-semibold text-ink-900 text-xs">{p.name}</div>
                    <div className="text-[0.75rem] font-medium text-emerald-800">{p.localTime}</div>
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-200">
          {DAYS.map((day) => (
            <tr key={day} className="hover:bg-slate-50/50 transition-colors">
              <td className="border-r border-slate-200 bg-slate-50/75 p-3 font-semibold text-ink-900 whitespace-nowrap">
                {DAY_LABELS[day]}
              </td>

              {periods.map((p) => {
                // ── Break cell ────────────────────────────────────────────────
                if (p.isBreak) {
                  return (
                    <td
                      key={p.id}
                      className="border-r border-slate-200 bg-amber-50/40 p-2 text-center align-middle text-[0.7rem] text-amber-800 font-medium select-none"
                    >
                      ☕ Rest
                    </td>
                  );
                }

                const entry = entryMap.get(`${day}_${p.startTime}_${p.endTime}`);

                // ── Filled cell ───────────────────────────────────────────────
                if (entry) {
                  return (
                    <td key={p.id} className="border-r border-slate-200 p-2 align-top last:border-r-0">
                      <div className="group relative flex flex-col justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 transition-all hover:border-emerald-300 hover:shadow-sm">
                        <div>
                          <div className="mb-1 flex items-center justify-between gap-1 flex-wrap">
                            <span className="font-semibold text-emerald-950 text-xs truncate max-w-[80px]" title={entry.teacherSubject.subject.subjectName}>
                              {entry.teacherSubject.subject.subjectName}
                            </span>
                            <div className="flex gap-1 flex-wrap">
                              {entry.roomNumber && (
                                <Badge className="text-[0.6rem] px-1.5 bg-emerald-100 text-emerald-800">
                                  {entry.roomNumber}
                                </Badge>
                              )}
                              {entry.status === 'DRAFT' && (
                                <Badge className="text-[0.6rem] px-1 bg-amber-100 text-amber-800 border border-amber-200">
                                  Draft
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-[0.7rem] text-emerald-800/80 leading-snug">
                            {isTeacherView
                              ? `${entry.teacherSubject.classroom.className} — Sec ${entry.teacherSubject.classroom.section}`
                              : `${entry.teacherSubject.teacher.firstName} ${entry.teacherSubject.teacher.lastName}`}
                          </p>
                          {!isTeacherView && (
                            <span className="inline-block mt-0.5 text-[0.65rem] font-semibold text-emerald-700/80">
                              Sec {entry.teacherSubject.classroom.section}
                            </span>
                          )}
                        </div>
                        {isEditable && onDeleteSlot && (
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => onDeleteSlot(entry)}
                              className="text-[0.65rem] text-rose-600 hover:text-rose-800 underline font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                }

                // ── Empty cell ────────────────────────────────────────────────
                return (
                  <td key={p.id} className="border-r border-slate-200 p-2 align-top last:border-r-0">
                    {isEditable ? (
                      <button
                        type="button"
                        onClick={() => onFillSlot?.(day, p.startTime, p.endTime, p.periodNumber!)}
                        className="group flex h-full min-h-[64px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-2 text-slate-400 transition-all hover:border-emerald-400 hover:bg-emerald-50/30 hover:text-emerald-600"
                        title={`Add ${p.name} on ${DAY_LABELS[day]} (${p.localTime})`}
                      >
                        <span className="text-lg leading-none group-hover:scale-110 transition-transform">+</span>
                        <span className="text-[0.65rem] font-medium mt-0.5">Fill slot</span>
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
