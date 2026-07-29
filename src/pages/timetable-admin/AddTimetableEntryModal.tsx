import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { useCreateTimetableEntry } from '../../hooks/useTimetable';
import type { DayOfWeek } from '../../types/timetable';
import type { TeacherSubjectAssignment } from '../../types/teacher-subject';

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
}

export function AddTimetableEntryModal({ isOpen, onClose, teachingAssignments }: AddTimetableEntryModalProps) {
  const createEntry = useCreateTimetableEntry();

  const [teacherSubjectId, setTeacherSubjectId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>('MONDAY');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTeacherSubjectId('');
    setDayOfWeek('MONDAY');
    setStartTime('');
    setEndTime('');
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
        dayOfWeek,
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
    <Modal title="Add timetable slot" isOpen={isOpen} onClose={handleClose} widthClassName="max-w-[480px]">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <SelectField label="Subject &amp; teacher" value={teacherSubjectId} onChange={(e) => setTeacherSubjectId(e.target.value)}>
          <option value="">Select…</option>
          {teachingAssignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.subject.subjectName} — {a.teacher.firstName} {a.teacher.lastName}
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
