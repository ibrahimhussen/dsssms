import { useState } from 'react';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { useAssignments } from '../../hooks/useTeacherSubjects';
import { useTimetable, useDeleteTimetableEntry } from '../../hooks/useTimetable';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { AddTimetableEntryModal } from './AddTimetableEntryModal';
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

export function TimetableAdminPage() {
  const { data: classrooms } = useClassroomOptions();
  const [classroomId, setClassroomId] = useState<number | undefined>(undefined);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TimetableEntry | null>(null);

  const { data: teachingAssignments } = useAssignments({ classroomId, limit: 100 });
  const { data: entries, isLoading } = useTimetable({ classroomId });
  const deleteEntry = useDeleteTimetableEntry();

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    await deleteEntry.mutateAsync(pendingDelete.timetableEntryId);
    setPendingDelete(null);
  }

  const byDay = new Map<DayOfWeek, TimetableEntry[]>();
  for (const e of entries ?? []) {
    const list = byDay.get(e.dayOfWeek) ?? [];
    list.push(e);
    byDay.set(e.dayOfWeek, list);
  }

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Class timetable</h1>
      <LedgerRule />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <SelectField
          label="Classroom"
          className="min-w-[220px]"
          value={classroomId ?? ''}
          onChange={(e) => setClassroomId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Select a classroom…</option>
          {classrooms?.items.map((c) => (
            <option key={c.classroomId} value={c.classroomId}>
              {c.className} {c.section} ({c.academicYear})
            </option>
          ))}
        </SelectField>

        {classroomId && (
          <Button onClick={() => setIsAddOpen(true)} disabled={!teachingAssignments || teachingAssignments.items.length === 0}>
            Add timetable slot
          </Button>
        )}
      </div>

      {!classroomId ? (
        <EmptyState title="Select a classroom above" description="Choose a classroom to view or build its weekly timetable." />
      ) : teachingAssignments && teachingAssignments.items.length === 0 ? (
        <EmptyState
          title="No teaching assignments for this classroom"
          description="Assign a teacher to a subject for this classroom first, under Teaching assignments."
        />
      ) : isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !entries || entries.length === 0 ? (
        <EmptyState title="No schedule yet" description="Add the first timetable slot for this classroom." />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {DAYS.filter((d) => (byDay.get(d)?.length ?? 0) > 0).map((day) => (
            <div key={day} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                      <p className="mb-1.5 text-[0.8125rem] text-slate-500">
                        {e.teacherSubject.subject.subjectName} · {e.teacherSubject.teacher.firstName}{' '}
                        {e.teacherSubject.teacher.lastName}
                      </p>
                      <Button variant="ghost" onClick={() => setPendingDelete(e)}>
                        Remove
                      </Button>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {classroomId && (
        <AddTimetableEntryModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          teachingAssignments={teachingAssignments?.items ?? []}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Remove timetable slot"
        message={`Remove this ${pendingDelete ? DAY_LABELS[pendingDelete.dayOfWeek] : ''} slot? This cannot be undone.`}
        confirmLabel="Remove"
        isLoading={deleteEntry.isPending}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
