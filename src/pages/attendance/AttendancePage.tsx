import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMyTeachingAssignments } from '../../hooks/useDashboardData';
import { useClassroomOptions } from '../../hooks/useClassrooms';
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

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'PRESENT', label: 'Present', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'ABSENT', label: 'Absent', color: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'LATE', label: 'Late', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'EXCUSED', label: 'Excused', color: 'bg-blue-100 text-blue-800 border-blue-200' },
];

const STATUS_BADGE: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-800',
  ABSENT: 'bg-red-100 text-red-800',
  LATE: 'bg-amber-100 text-amber-800',
  EXCUSED: 'bg-blue-100 text-blue-800',
};

/** Roles that may only view attendance, never submit it */
const VIEW_ONLY_ROLES = ['DIRECTOR', 'VICE_DIRECTOR'];

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function AttendancePage() {
  const { user } = useAuth();
  const isViewOnly = VIEW_ONLY_ROLES.includes(user?.role ?? '');

  // Directors/Vice Directors browse all classrooms; teachers see only their assigned ones
  const { data: assignments } = useMyTeachingAssignments();
  const { data: allClassrooms } = useClassroomOptions();

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

  // Build classroom dropdown options based on role
  const classroomOptions = useMemo(() => {
    if (isViewOnly) {
      return (allClassrooms?.items ?? []).map((c) => ({
        classroomId: c.classroomId,
        label: `${c.className} ${c.section} (${c.academicYear})`,
      }));
    }
    // Teachers: de-duplicate by classroom across their subject assignments
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
  }, [isViewOnly, allClassrooms, assignments]);

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

  const pageTitle = isViewOnly ? 'Attendance overview' : 'Take attendance';
  const emptyHint = isViewOnly
    ? 'Choose a classroom above to view the recorded attendance for that date and period.'
    : 'Choose one of your assigned classrooms above.';

  return (
    <div className="max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl">{pageTitle}</h1>
        {isViewOnly && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            👁 View only — you cannot submit attendance
          </span>
        )}
      </div>
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
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((p) => (
            <option key={p} value={p}>Period {p}</option>
          ))}
        </SelectField>
      </div>

      {!classroomId ? (
        <EmptyState title="Select a classroom to begin" description={emptyHint} />
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
            {!isViewOnly && (
              <Button variant="ghost" onClick={markAllPresent}>
                Mark all as present
              </Button>
            )}
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
                {rosterData.items.map((s) => {
                  const record = existingRecords?.find((r) => r.studentId === s.studentId);
                  const isLocked = record?.isLocked ?? false;

                  return (
                    <tr key={s.studentId} className="border-b border-paper-100 last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-ink-900">{s.firstName} {s.lastName}</span>
                          <span className="font-mono text-xs text-slate-500">({s.admissionNumber})</span>
                        </div>
                        {isLocked && (
                          <Badge className="mt-1" tone="warning">Locked</Badge>
                        )}
                      </td>

                      {/* Status column */}
                      <td className="px-4 py-3">
                        {isViewOnly ? (
                          /* READ-ONLY: show a coloured badge for the recorded status */
                          record ? (
                            <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_BADGE[record.status]}`}>
                              {record.status.charAt(0) + record.status.slice(1).toLowerCase()}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Not recorded</span>
                          )
                        ) : (
                          /* EDITABLE: clickable status buttons */
                          <div className="flex flex-wrap gap-1.5">
                            {STATUS_OPTIONS.map((opt) => {
                              const isSelected = statusFor(s.studentId) === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() => setStatus(s.studentId, opt.value)}
                                  className={
                                    isSelected
                                      ? 'rounded-full bg-pine-900 px-3 py-1 text-xs font-semibold text-paper-50'
                                      : 'rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-ink-700 hover:bg-paper-100 disabled:cursor-not-allowed disabled:opacity-50'
                                  }
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Remarks column */}
                      <td className="px-4 py-3">
                        {isViewOnly ? (
                          <span className="text-sm text-slate-600">
                            {record?.remarks || <span className="italic text-slate-400">—</span>}
                          </span>
                        ) : (
                          <input
                            type="text"
                            placeholder="Optional note…"
                            maxLength={255}
                            disabled={isLocked}
                            value={remarksFor(s.studentId)}
                            onChange={(e) => setRemarks(s.studentId, e.target.value)}
                            className="w-full min-w-[160px] rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
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

          {/* Only show Save button for non-oversight roles */}
          {!isViewOnly && (
            <div className="mt-4 flex justify-end">
              <Button onClick={() => void handleSubmit()} isLoading={markBulk.isPending}>
                Save attendance
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
