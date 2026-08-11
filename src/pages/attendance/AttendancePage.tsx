import { useMemo, useState } from 'react';
import { useMyTeachingAssignments } from '../../hooks/useDashboardData';
import { useStudents } from '../../hooks/useStudents';
import { useClassroomAttendance, useMarkBulkAttendance } from '../../hooks/useAttendance';
import { attendanceApi } from '../../lib/attendance-api';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
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

function thirtyDaysAgoIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function AttendancePage() {
  const { data: assignments } = useMyTeachingAssignments();
  const [classroomId, setClassroomId] = useState<number | undefined>(undefined);
  const [attendanceDate, setAttendanceDate] = useState<string>(todayIsoDate());
  const [period, setPeriod] = useState<number>(0);
  const [draftStatuses, setDraftStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [draftRemarks, setDraftRemarks] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    if (!classroomId) return;
    setIsExporting(true);
    try {
      await attendanceApi.exportClassroomAttendance({ classroomId, from: thirtyDaysAgoIsoDate(), to: todayIsoDate() });
    } finally {
      setIsExporting(false);
    }
  }

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
  const { data: existingRecords } = useClassroomAttendance(classroomId, attendanceDate, period);
  const markBulk = useMarkBulkAttendance();

  function statusFor(studentId: number): AttendanceStatus {
    if (draftStatuses[studentId]) return draftStatuses[studentId];
    const existing = existingRecords?.find((r) => r.studentId === studentId);
    return existing?.status ?? 'PRESENT';
  }

  function remarksFor(studentId: number): string {
    if (draftRemarks[studentId] !== undefined) return draftRemarks[studentId];
    const existing = existingRecords?.find((r) => r.studentId === studentId);
    return existing?.remarks ?? '';
  }

  function setStatus(studentId: number, status: AttendanceStatus) {
    setDraftStatuses((prev) => ({ ...prev, [studentId]: status }));
  }

  function setRemarks(studentId: number, remarks: string) {
    setDraftRemarks((prev) => ({ ...prev, [studentId]: remarks }));
  }

  function markAllPresent() {
    if (!rosterData) return;
    setDraftStatuses(Object.fromEntries(rosterData.items.map((s) => [s.studentId, 'PRESENT' as AttendanceStatus])));
  }

  async function handleSubmit() {
    if (!classroomId || !rosterData) return;
    setFeedback(null);

    const records: BulkAttendanceRecordInput[] = rosterData.items.map((s) => {
      const remarks = remarksFor(s.studentId).trim();
      return { studentId: s.studentId, status: statusFor(s.studentId), ...(remarks ? { remarks } : {}) };
    });

    try {
      const result = await markBulk.mutateAsync({ classroomId, attendanceDate, period, records });
      setFeedback({ type: 'success', message: `Saved attendance for ${result.recordsSaved} student(s).` });
      setDraftStatuses({});
      setDraftRemarks({});
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

        <SelectField
          label="Period"
          className="min-w-[150px]"
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
        >
          <option value={0}>Daily Roll Call (0)</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(p => (
            <option key={p} value={p}>Period {p}</option>
          ))}
        </SelectField>
      </div>

      {!classroomId ? (
        <EmptyState title="Select a classroom to begin" description="Choose one of your assigned classrooms above." />
      ) : isRosterLoading ? (
        <p className="text-sm text-slate-500">Loading roster…</p>
      ) : !rosterData || rosterData.items.length === 0 ? (
        <EmptyState title="No students enrolled" description="This classroom has no enrolled students yet." />
      ) : (
        <>
          <div className="mb-3 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => void handleExport()} isLoading={isExporting}>
              Export last 30 days (Excel)
            </Button>
            <Button variant="ghost" onClick={markAllPresent}>
              Mark all as present
            </Button>
          </div>

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
                  <th className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody>
                {rosterData.items.map((s) => (
                  <tr key={s.studentId} className="border-b border-paper-100 last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-ink-900">{s.firstName} {s.lastName}</span>
                        <span className="font-mono text-xs text-slate-500">({s.admissionNumber})</span>
                      </div>
                      {existingRecords?.find((r) => r.studentId === s.studentId)?.isLocked && (
                        <Badge className="mt-1" tone="warning">Locked</Badge>
                      )}
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
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="Optional note…"
                        maxLength={255}
                        value={remarksFor(s.studentId)}
                        onChange={(e) => setRemarks(s.studentId, e.target.value)}
                        className="w-full min-w-[160px] rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                      />
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
