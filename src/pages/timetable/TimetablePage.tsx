import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMyTimetable } from '../../hooks/useTimetable';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import { SelectField } from '../../components/ui/SelectField';
import { TimetableMatrixTable } from '../timetable-admin/TimetableMatrixTable';
import { MORNING_PERIODS, AFTERNOON_PERIODS, findPeriodByTime } from '../../lib/timetable-periods';
import type { DayOfWeek, TimetableEntry } from '../../types/timetable';
import type { Semester } from '../../types/grade';

type SessionView = 'MORNING' | 'AFTERNOON' | 'ALL';

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY:    'Monday',
  TUESDAY:   'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY:  'Thursday',
  FRIDAY:    'Friday',
  SATURDAY:  'Saturday',
};

// ── Detect which sessions are actually present in the entries ────────────────
function detectSession(entries: TimetableEntry[]): SessionView {
  for (const e of entries) {
    const p = findPeriodByTime(e.startTime, e.endTime);
    if (p?.session === 'Morning')   return 'MORNING';
    if (p?.session === 'Afternoon') return 'AFTERNOON';
  }
  return 'MORNING'; // default when empty or unknown
}

// ── Card-list view for one session ───────────────────────────────────────────
function SessionCardList({
  entries,
  session,
  isTeacher,
}: {
  entries: TimetableEntry[];
  session: 'MORNING' | 'AFTERNOON';
  isTeacher: boolean;
}) {
  const allPeriods = session === 'MORNING' ? MORNING_PERIODS : AFTERNOON_PERIODS;

  // Build lookup: `${day}_${startTime}_${endTime}` → entry
  const entryMap = useMemo(() => {
    const map = new Map<string, TimetableEntry>();
    for (const e of entries) map.set(`${e.dayOfWeek}_${e.startTime}_${e.endTime}`, e);
    return map;
  }, [entries]);

  // Which days actually have at least one entry in this session?
  const sessionStartTimes = new Set(allPeriods.filter((p) => !p.isBreak).map((p) => p.startTime));
  const activeDays = DAYS.filter((d) =>
    [...entryMap.keys()].some((k) => k.startsWith(`${d}_`) && sessionStartTimes.has(k.split('_')[1]))
  );

  if (activeDays.length === 0) {
    return (
      <p className="py-4 text-sm text-slate-400 italic">
        No {session === 'MORNING' ? 'morning' : 'afternoon'} classes scheduled.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
      {activeDays.map((day) => (
        <Card key={day}>
          <h3 className="mb-3 text-base font-semibold">{DAY_LABELS[day]}</h3>
          <ul className="flex flex-col gap-2">
            {allPeriods.map((p) => {
              // ── Break row ──────────────────────────────────────────────────
              if (p.isBreak) {
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2"
                  >
                    <span className="text-sm">☕</span>
                    <div>
                      <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                        Break
                      </span>
                      <span className="ml-2 text-xs text-amber-700">{p.localTime}</span>
                    </div>
                  </li>
                );
              }

              const entry = entryMap.get(`${day}_${p.startTime}_${p.endTime}`);

              if (!entry) {
                return (
                  <li
                    key={p.id}
                    className="flex items-start gap-3 rounded-lg border border-paper-100 px-3 py-2.5 opacity-40"
                  >
                    <div className="min-w-[80px] text-xs text-slate-400">{p.localTime}</div>
                    <span className="text-xs text-slate-300">—</span>
                  </li>
                );
              }

              return (
                <li
                  key={p.id}
                  className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5"
                >
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="text-xs text-emerald-700 font-medium">{p.localTime}</span>
                    {entry.roomNumber && <Badge>{entry.roomNumber}</Badge>}
                  </div>
                  <p className="text-sm font-semibold text-ink-900">
                    {entry.teacherSubject.subject.subjectName}
                  </p>
                  <p className="text-[0.8125rem] text-slate-500">
                    {isTeacher
                      ? `${entry.teacherSubject.classroom.className} ${entry.teacherSubject.classroom.section}`
                      : `${entry.teacherSubject.teacher.firstName} ${entry.teacherSubject.teacher.lastName}`}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function TimetablePage() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';
  const isStudent = user?.role === 'STUDENT';

  const [semester,    setSemester]    = useState<Semester>('SEMESTER_1');
  const [viewMode,    setViewMode]    = useState<'grid' | 'cards'>('grid');
  const [sessionView, setSessionView] = useState<SessionView | 'AUTO'>('AUTO');

  const { data: entries, isLoading } = useMyTimetable(semester);

  // For students: auto-detect session from their actual entries on first load
  const detectedSession = useMemo<SessionView>(
    () => (entries && entries.length > 0 ? detectSession(entries) : 'MORNING'),
    [entries]
  );

  // Resolved session to display
  const resolvedSession: SessionView = sessionView === 'AUTO' ? detectedSession : sessionView;

  // Filter entries per session for the matrix
  const morningEntries   = useMemo(() => (entries ?? []).filter((e) => {
    const p = findPeriodByTime(e.startTime, e.endTime);
    return p?.session === 'Morning';
  }), [entries]);

  const afternoonEntries = useMemo(() => (entries ?? []).filter((e) => {
    const p = findPeriodByTime(e.startTime, e.endTime);
    return p?.session === 'Afternoon';
  }), [entries]);

  const hasAnyEntries = (entries ?? []).length > 0;

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderGrid() {
    if (resolvedSession === 'ALL') {
      return (
        <div className="flex flex-col gap-8">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-base font-semibold text-amber-900">☀️ Morning Session</span>
              <span className="text-xs text-slate-400">02:00 – 06:15 · Break 04:00 – 04:15</span>
            </div>
            {morningEntries.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No morning classes scheduled.</p>
            ) : (
              <TimetableMatrixTable
                entries={morningEntries}
                sessionFilter="MORNING"
                isEditable={false}
                isTeacherView={isTeacher}
              />
            )}
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-base font-semibold text-indigo-900">🌤️ Afternoon Session</span>
              <span className="text-xs text-slate-400">06:30 – 10:45 · Break 08:30 – 08:45</span>
            </div>
            {afternoonEntries.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No afternoon classes scheduled.</p>
            ) : (
              <TimetableMatrixTable
                entries={afternoonEntries}
                sessionFilter="AFTERNOON"
                isEditable={false}
                isTeacherView={isTeacher}
              />
            )}
          </div>
        </div>
      );
    }

    return (
      <TimetableMatrixTable
        entries={entries ?? []}
        sessionFilter={resolvedSession}
        isEditable={false}
        isTeacherView={isTeacher}
      />
    );
  }

  function renderCards() {
    if (resolvedSession === 'ALL') {
      return (
        <div className="flex flex-col gap-8">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-base font-semibold text-amber-900">☀️ Morning Session</span>
            </div>
            <SessionCardList entries={morningEntries} session="MORNING" isTeacher={isTeacher} />
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-base font-semibold text-indigo-900">🌤️ Afternoon Session</span>
            </div>
            <SessionCardList entries={afternoonEntries} session="AFTERNOON" isTeacher={isTeacher} />
          </div>
        </div>
      );
    }

    return (
      <SessionCardList
        entries={resolvedSession === 'MORNING' ? morningEntries : afternoonEntries}
        session={resolvedSession}
        isTeacher={isTeacher}
      />
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl">{isTeacher ? 'Class timetable' : 'My timetable'}</h1>

        <div className="flex flex-wrap items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 transition-colors ${
                viewMode === 'grid' ? 'bg-white text-ink-900 shadow-xs' : 'text-slate-600 hover:text-ink-900'
              }`}
              onClick={() => setViewMode('grid')}
            >
              Table Grid
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 transition-colors ${
                viewMode === 'cards' ? 'bg-white text-ink-900 shadow-xs' : 'text-slate-600 hover:text-ink-900'
              }`}
              onClick={() => setViewMode('cards')}
            >
              Card List
            </button>
          </div>

          {/* Session selector — students always see this; teachers see it too */}
          <SelectField
            label="Session"
            className="min-w-[190px]"
            value={sessionView === 'AUTO' ? resolvedSession : sessionView}
            onChange={(e) => setSessionView(e.target.value as SessionView)}
          >
            <option value="MORNING">☀️ Morning Session</option>
            <option value="AFTERNOON">🌤️ Afternoon Session</option>
            <option value="ALL">All Sessions</option>
          </SelectField>

          {/* Semester selector */}
          <SelectField
            label="Semester"
            className="min-w-[170px]"
            value={semester}
            onChange={(e) => setSemester(e.target.value as Semester)}
          >
            <option value="SEMESTER_1">Semester 1 (SEM 1)</option>
            <option value="SEMESTER_2">Semester 2 (SEM 2)</option>
          </SelectField>
        </div>
      </div>
      <LedgerRule />

      {/* Session label badge — shown below controls for students */}
      {isStudent && !isLoading && hasAnyEntries && resolvedSession !== 'ALL' && (
        <div className="mb-5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              resolvedSession === 'MORNING'
                ? 'bg-amber-100 text-amber-900'
                : 'bg-indigo-100 text-indigo-900'
            }`}
          >
            {resolvedSession === 'MORNING' ? '☀️ Morning Session · 02:00 – 06:15' : '🌤️ Afternoon Session · 06:30 – 10:45'}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-12 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700" />
          Loading timetable…
        </div>
      ) : !hasAnyEntries ? (
        <EmptyState
          title={`No schedule for ${semester === 'SEMESTER_1' ? 'Semester 1' : 'Semester 2'}`}
          description={`A timetable hasn't been set up for ${semester === 'SEMESTER_1' ? 'Semester 1' : 'Semester 2'} yet.`}
        />
      ) : viewMode === 'grid' ? (
        renderGrid()
      ) : (
        renderCards()
      )}
    </div>
  );
}
