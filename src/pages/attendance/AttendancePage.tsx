import { useMemo, useState } from 'react';
import { useMyTeachingAssignments } from '../../hooks/useDashboardData';
import { useStudents } from '../../hooks/useStudents';
import { useClassroomAttendance, useMarkBulkAttendance } from '../../hooks/useAttendance';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import type { AttendanceStatus, BulkAttendanceRecordInput } from '../../types/attendance';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'LATE', label: 'Late' },
  { value: 'EXCUSED', label: 'Excused' },
];

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AttendancePage() {
  const { data: assignments } = useMyTeachingAssignments();
  const [classroomId, setClassroomId] = useState<number | undefined>(undefined);
  const [attendanceDate, setAttendanceDate] = useState<string>(todayIsoDate());
  const [draftStatuses, setDraftStatuses] = useState<Record<number, BulkAttendanceRecordInput>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // A teacher may teach the same classroom for several subjects — de-duplicate to one entry per classroom.
  const classroomOptions = useMemo(() => {
    const seen = new Map<number, { classroomId: number; label: string }>();
    for (const a of assignments ?? []) {
      if (!seen.has(a.classroom.classroomId)) {
        seen.set(a.classroom.classroomId, {
          classroomId: a.classroom.classroomId,
          label: `${a.classroom.className} ${a.classroom.section} (${a.classroom.academicYear})`,
        });
      }
    }
    return [...seen.values()];
  }, [assignments]);

  const { data: rosterData, isLoading: isRosterLoading } = useStudents(
    { classroomId, limit: 100 },
    { enabled: Boolean(classroomId) }
  );
  const { data: existingRecords } = useClassroomAttendance(classroomId, attendanceDate);
  const markBulk = useMarkBulkAttendance();

  function statusFor(studentId: number): AttendanceStatus {
    if (draftStatuses[studentId]) return draftStatuses[studentId].status;
    const existing = existingRecords?.find((r) => r.studentId === studentId);
    return existing?.status ?? 'PRESENT';
  }

  function setStatus(studentId: number, status: AttendanceStatus) {
    setDraftStatuses((prev) => ({ ...prev, [studentId]: { studentId, status } }));
  }

  async function handleSubmit() {
    if (!classroomId || !rosterData) return;
    setFeedback(null);

    const records: BulkAttendanceRecordInput[] = rosterData.items.map((s) => ({
      studentId: s.studentId,
      status: statusFor(s.studentId),
    }));

    try {
      const result = await markBulk.mutateAsync({ classroomId, attendanceDate, records });
      setFeedback({ type: 'success', message: `Saved attendance for ${result.recordsSaved} student(s).` });
      setDraftStatuses({});
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Could not save attendance.' });
    }
  }

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Take attendance</h1>
      <LedgerRule />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <SelectField
          label="Classroom"
          className="min-w-[220px]"
          value={classroomId ?? ''}
          onChange={(e) => setClassroomId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Select a classroom…</option>
          {classroomOptions.map((c) => (
            <option key={c.classroomId} value={c.classroomId}>
              {c.label}
            </option>
          ))}
        </SelectField>

        <TextField
          label="Date"
          type="date"
          max={todayIsoDate()}
          value={attendanceDate}
          onChange={(e) => setAttendanceDate(e.target.value)}
        />
      </div>

      {!classroomId ? (
        <EmptyState title="Select a classroom to begin" description="Choose one of your assigned classrooms above." />
      ) : isRosterLoading ? (
        <p className="text-sm text-slate-500">Loading roster…</p>
      ) : !rosterData || rosterData.items.length === 0 ? (
        <EmptyState title="No students enrolled" description="This classroom has no enrolled students yet." />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase">
                    Student
                  </th>
                  <th className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rosterData.items.map((s) => (
                  <tr key={s.studentId} className="border-b border-paper-100 last:border-b-0">
                    <td className="px-4 py-3">
                      {s.firstName} {s.lastName}{' '}
                      <span className="font-mono text-xs text-slate-500">({s.admissionNumber})</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_OPTIONS.map((opt) => {
                          const isSelected = statusFor(s.studentId) === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setStatus(s.studentId, opt.value)}
                              className={
                                isSelected
                                  ? 'rounded-full bg-pine-900 px-3 py-1 text-xs font-semibold text-paper-50'
                                  : 'rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-ink-700 hover:bg-paper-100'
                              }
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {feedback && (
            <p
              className={`mt-4 rounded-lg px-3 py-2.5 text-sm ${
                feedback.type === 'success' ? 'bg-pine-100 text-pine-800' : 'bg-danger-100 text-danger-600'
              }`}
              role="status"
            >
              {feedback.message}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <Button onClick={() => void handleSubmit()} isLoading={markBulk.isPending}>
              Save attendance
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
