import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { useCreateTimetableEntry } from '../../hooks/useTimetable';
import {
  MORNING_PERIODS,
  AFTERNOON_PERIODS,
  isBreakSlot,
  type TimetablePeriod,
} from '../../lib/timetable-periods';
import type { DayOfWeek } from '../../types/timetable';
import type { TeacherSubjectAssignment } from '../../types/teacher-subject';
import type { Semester } from '../../types/grade';

type SchoolSession = 'MORNING' | 'AFTERNOON';

const DAY_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: 'MONDAY',    label: 'Monday'    },
  { value: 'TUESDAY',   label: 'Tuesday'   },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY',  label: 'Thursday'  },
  { value: 'FRIDAY',    label: 'Friday'    },
  { value: 'SATURDAY',  label: 'Saturday'  },
];

interface AddTimetableEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachingAssignments: TeacherSubjectAssignment[];
  initialSemester?: Semester;
  initialDayOfWeek?: DayOfWeek;
  initialStartTime?: string;
  initialEndTime?: string;
  initialSession?: SchoolSession;
}

export function AddTimetableEntryModal({
  isOpen,
  onClose,
  teachingAssignments,
  initialSemester  = 'SEMESTER_1',
  initialDayOfWeek = 'MONDAY',
  initialStartTime = '',
  initialEndTime   = '',
  initialSession,
}: AddTimetableEntryModalProps) {
  const createEntry = useCreateTimetableEntry();

  const [teacherSubjectId, setTeacherSubjectId] = useState('');
  const [semester, setSemester]       = useState<Semester>(initialSemester);
  const [dayOfWeek, setDayOfWeek]     = useState<DayOfWeek>(initialDayOfWeek);
  const [session, setSession]         = useState<SchoolSession>(initialSession ?? 'MORNING');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [roomNumber, setRoomNumber]   = useState('');
  const [error, setError]             = useState<string | null>(null);

  // Teaching periods for the selected session (no breaks)
  const sessionPeriods: TimetablePeriod[] = session === 'MORNING'
    ? MORNING_PERIODS.filter((p) => !p.isBreak)
    : AFTERNOON_PERIODS.filter((p) => !p.isBreak);

  // Selected period object
  const selectedPeriod = sessionPeriods.find((p) => p.id === selectedPeriodId) ?? null;

  // When initial props change (e.g. clicking "Fill slot"), sync state
  useEffect(() => {
    if (!isOpen) return;
    setSemester(initialSemester);
    setDayOfWeek(initialDayOfWeek);

    if (initialStartTime && initialEndTime) {
      // Determine session from the start time
      const inferredSession: SchoolSession = initialStartTime < '12:30' ? 'MORNING' : 'AFTERNOON';
      setSession(inferredSession ?? initialSession ?? 'MORNING');

      // Find matching period
      const allPeriods = inferredSession === 'MORNING' ? MORNING_PERIODS : AFTERNOON_PERIODS;
      const match = allPeriods.find(
        (p) => p.startTime === initialStartTime && p.endTime === initialEndTime
      );
      setSelectedPeriodId(match?.id ?? '');
    } else {
      setSession(initialSession ?? 'MORNING');
      setSelectedPeriodId('');
    }
  }, [isOpen, initialSemester, initialDayOfWeek, initialStartTime, initialEndTime, initialSession]);

  function reset() {
    setTeacherSubjectId('');
    setSemester(initialSemester);
    setDayOfWeek(initialDayOfWeek);
    setSession(initialSession ?? 'MORNING');
    setSelectedPeriodId('');
    setRoomNumber('');
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!teacherSubjectId) {
      setError('Please select a subject and teacher.');
      return;
    }
    if (!selectedPeriod) {
      setError('Please select a period.');
      return;
    }
    if (isBreakSlot(selectedPeriod.startTime, selectedPeriod.endTime)) {
      setError('Cannot schedule a class during a break period.');
      return;
    }

    try {
      await createEntry.mutateAsync({
        teacherSubjectId: Number(teacherSubjectId),
        semester,
        dayOfWeek,
        period: selectedPeriod.periodNumber!,
        startTime: selectedPeriod.startTime,
        endTime: selectedPeriod.endTime,
        roomNumber: roomNumber.trim() || undefined,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this timetable slot.');
    }
  }

  return (
    <Modal title="Add timetable slot" isOpen={isOpen} onClose={handleClose} widthClassName="max-w-[480px]">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="flex flex-col gap-3">

        <SelectField label="Semester" value={semester} onChange={(e) => setSemester(e.target.value as Semester)}>
          <option value="SEMESTER_1">Semester 1</option>
          <option value="SEMESTER_2">Semester 2</option>
        </SelectField>

        {/* Session selector */}
        <div>
          <label className="mb-1.5 block text-[0.8125rem] font-semibold text-ink-700">Session</label>
          <div className="flex gap-2">
            {(['MORNING', 'AFTERNOON'] as SchoolSession[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setSession(s); setSelectedPeriodId(''); }}
                className={[
                  'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                  session === s
                    ? s === 'MORNING'
                      ? 'border-amber-500 bg-amber-500 text-white'
                      : 'border-indigo-500 bg-indigo-500 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                ].join(' ')}
              >
                {s === 'MORNING' ? '☀️ Morning Session' : '🌤️ Afternoon Session'}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[0.75rem] text-slate-500">
            {session === 'MORNING'
              ? 'Morning: 02:00–06:15 · Break 04:00–04:15'
              : 'Afternoon: 06:30–10:45 · Break 08:30–08:45'}
          </p>
        </div>

        {/* Period selector */}
        <div>
          <label className="mb-1.5 block text-[0.8125rem] font-semibold text-ink-700">Period</label>
          <div className="grid grid-cols-3 gap-1.5">
            {sessionPeriods.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPeriodId(p.id)}
                className={[
                  'rounded-lg border px-2 py-2 text-left transition-colors',
                  selectedPeriodId === p.id
                    ? 'border-pine-700 bg-pine-700 text-white'
                    : 'border-slate-200 hover:border-pine-700/40 hover:bg-pine-50',
                ].join(' ')}
              >
                <div className="text-xs font-semibold">{p.name}</div>
                <div className={`text-[0.7rem] ${selectedPeriodId === p.id ? 'text-white/80' : 'text-emerald-700'}`}>
                  {p.localTime}
                </div>
              </button>
            ))}
          </div>
        </div>

        <SelectField
          label="Subject &amp; teacher"
          value={teacherSubjectId}
          onChange={(e) => setTeacherSubjectId(e.target.value)}
        >
          <option value="">Select subject and teacher…</option>
          {teachingAssignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.subject.subjectName} — {a.teacher.firstName} {a.teacher.lastName} ({a.classroom.className} Sec {a.classroom.section})
            </option>
          ))}
        </SelectField>

        <SelectField label="Day" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}>
          {DAY_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </SelectField>

        <TextField
          label="Room (optional)"
          value={roomNumber}
          onChange={(e) => setRoomNumber(e.target.value)}
          maxLength={50}
          placeholder="e.g. Room 12"
        />

        {/* Summary */}
        {selectedPeriod && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-600">
            <span className="font-medium">Slot: </span>
            {DAY_OPTIONS.find((d) => d.value === dayOfWeek)?.label} · {selectedPeriod.name} · {selectedPeriod.localTime}
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button type="submit" isLoading={createEntry.isPending} disabled={!selectedPeriod || !teacherSubjectId}>
            Add slot
          </Button>
        </div>
      </form>
    </Modal>
  );
}
