import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { useCreateTimetableEntry } from '../../hooks/useTimetable';
import type { DayOfWeek } from '../../types/timetable';
import type { TeacherSubjectAssignment } from '../../types/teacher-subject';
import type { Semester } from '../../types/grade';

const DAY_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
];

interface AddTimetableEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachingAssignments: TeacherSubjectAssignment[];
  initialSemester?: Semester;
  initialDayOfWeek?: DayOfWeek;
  initialStartTime?: string;
  initialEndTime?: string;
  initialPeriod?: number;
}

const PRESET_PERIODS = [
  // Morning Session (2:00 – 6:15 Local / Rest 4:00–4:15) — 3 before rest, 3 after rest
  { label: 'M-P1 (2:00–2:40)', start: '08:00', end: '08:40', session: 'Morning', period: 1 },
  { label: 'M-P2 (2:40–3:20)', start: '08:40', end: '09:20', session: 'Morning', period: 2 },
  { label: 'M-P3 (3:20–4:00)', start: '09:20', end: '10:00', session: 'Morning', period: 3 },
  { label: 'M-P4 (4:15–4:55)', start: '10:15', end: '10:55', session: 'Morning', period: 4 },
  { label: 'M-P5 (4:55–5:35)', start: '10:55', end: '11:35', session: 'Morning', period: 5 },
  { label: 'M-P6 (5:35–6:15)', start: '11:35', end: '12:15', session: 'Morning', period: 6 },

  // Afternoon Session (6:30 – 10:45 Local / Rest 8:30–8:45) — 3 before rest, 3 after rest
  { label: 'A-P1 (6:30–7:10)', start: '12:30', end: '13:10', session: 'Afternoon', period: 7 },
  { label: 'A-P2 (7:10–7:50)', start: '13:10', end: '13:50', session: 'Afternoon', period: 8 },
  { label: 'A-P3 (7:50–8:30)', start: '13:50', end: '14:30', session: 'Afternoon', period: 9 },
  { label: 'A-P4 (8:45–9:25)', start: '14:45', end: '15:25', session: 'Afternoon', period: 10 },
  { label: 'A-P5 (9:25–10:05)', start: '15:25', end: '16:05', session: 'Afternoon', period: 11 },
  { label: 'A-P6 (10:05–10:45)', start: '16:05', end: '16:45', session: 'Afternoon', period: 12 },
];

export function AddTimetableEntryModal({
  isOpen,
  onClose,
  teachingAssignments,
  initialSemester = 'SEMESTER_1',
  initialDayOfWeek = 'MONDAY',
  initialStartTime = '',
  initialEndTime = '',
  initialPeriod = 1,
}: AddTimetableEntryModalProps) {
  const createEntry = useCreateTimetableEntry();

  const [teacherSubjectId, setTeacherSubjectId] = useState('');
  const [semester, setSemester] = useState<Semester>(initialSemester);
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(initialDayOfWeek);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [period, setPeriod] = useState(initialPeriod);
  const [roomNumber, setRoomNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSemester(initialSemester);
      setDayOfWeek(initialDayOfWeek);
      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
      setPeriod(initialPeriod);
    }
  }, [isOpen, initialSemester, initialDayOfWeek, initialStartTime, initialEndTime, initialPeriod]);

  function reset() {
    setTeacherSubjectId('');
    setSemester(initialSemester);
    setDayOfWeek(initialDayOfWeek);
    setStartTime(initialStartTime);
    setEndTime(initialEndTime);
    setPeriod(initialPeriod);
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

    if (!teacherSubjectId || !startTime || !endTime) {
      setError('Please select a class and fill in the start and end times.');
      return;
    }

    try {
      await createEntry.mutateAsync({
        teacherSubjectId: Number(teacherSubjectId),
        semester,
        dayOfWeek,
        period,
        startTime,
        endTime,
        roomNumber: roomNumber.trim() || undefined,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this timetable slot.');
    }
  }

  return (
    <Modal title="Add timetable slot" isOpen={isOpen} onClose={handleClose} widthClassName="max-w-[520px]">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="flex flex-col gap-3">
        <SelectField label="Semester" value={semester} onChange={(e) => setSemester(e.target.value as Semester)}>
          <option value="SEMESTER_1">Semester 1 (SEM 1)</option>
          <option value="SEMESTER_2">Semester 2 (SEM 2)</option>
        </SelectField>

        <SelectField label="Subject &amp; teacher" value={teacherSubjectId} onChange={(e) => setTeacherSubjectId(e.target.value)}>
          <option value="">Select subject and teacher…</option>
          {teachingAssignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.subject.subjectName} — {a.teacher.firstName} {a.teacher.lastName} ({a.classroom.className} Sec {a.classroom.section})
            </option>
          ))}
        </SelectField>

        <SelectField label="Day" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}>
          {DAY_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </SelectField>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">Quick Select Period (7 Daily Periods)</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PRESET_PERIODS.map((p) => {
              const isSelected = startTime === p.start && endTime === p.end;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setStartTime(p.start);
                    setEndTime(p.end);
                    setPeriod(p.period);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors border cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : p.session === 'Morning'
                      ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                      : 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                  }`}
                  title={`${p.label} (${p.session}): ${p.start} - ${p.end}`}
                >
                  {p.label} ({p.start})
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4">
          <TextField label="Start time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <TextField label="End time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>

        <TextField
          label="Room (optional)"
          value={roomNumber}
          onChange={(e) => setRoomNumber(e.target.value)}
          maxLength={50}
        />

        {error && (
          <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={createEntry.isPending}>
            Add slot
          </Button>
        </div>
      </form>
    </Modal>
  );
}
