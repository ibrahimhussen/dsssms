import { useMemo, useState } from 'react';
import { useMyTeachingAssignments } from '../../hooks/useDashboardData';
import { useStudents } from '../../hooks/useStudents';
import { useClassroomGrades, useRecordBulkGrades } from '../../hooks/useGrades';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import type { Semester } from '../../types/grade';

function currentAcademicYear(): string {
  const year = new Date().getFullYear();
  return `${year}/${String(year + 1).slice(2)}`;
}

export function GradesPage() {
  const { data: assignments } = useMyTeachingAssignments();
  const [assignmentKey, setAssignmentKey] = useState<string>('');
  const [semester, setSemester] = useState<Semester>('SEMESTER_1');
  const [academicYear, setAcademicYear] = useState<string>(currentAcademicYear());
  const [draftScores, setDraftScores] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedAssignment = useMemo(
    () => assignments?.find((a) => `${a.classroom.classroomId}:${a.subject.subjectId}` === assignmentKey),
    [assignments, assignmentKey]
  );

  const { data: rosterData, isLoading: isRosterLoading } = useStudents(
    { classroomId: selectedAssignment?.classroom.classroomId, limit: 100 },
    { enabled: Boolean(selectedAssignment) }
  );

  const gradesQuery = useClassroomGrades(
    selectedAssignment
      ? {
          classroomId: selectedAssignment.classroom.classroomId,
          subjectId: selectedAssignment.subject.subjectId,
          semester,
          academicYear,
        }
      : {}
  );

  const recordBulk = useRecordBulkGrades();

  function existingScoreFor(studentId: number): number | undefined {
    return gradesQuery.data?.find((g) => g.studentId === studentId)?.score;
  }

  function existingLetterFor(studentId: number): string | undefined {
    return gradesQuery.data?.find((g) => g.studentId === studentId)?.letterGrade;
  }

  function scoreFor(studentId: number): string {
    if (draftScores[studentId] !== undefined) return draftScores[studentId];
    const existing = existingScoreFor(studentId);
    return existing !== undefined ? String(existing) : '';
  }

  function setScore(studentId: number, value: string) {
    setDraftScores((prev) => ({ ...prev, [studentId]: value }));
  }

  async function handleSubmit() {
    if (!selectedAssignment || !rosterData) return;
    setFeedback(null);

    const records = rosterData.items
      .map((s) => {
        const raw = scoreFor(s.studentId);
        const score = Number(raw);
        return raw !== '' && Number.isFinite(score) ? { studentId: s.studentId, score } : null;
      })
      .filter((r): r is { studentId: number; score: number } => r !== null);

    if (records.length === 0) {
      setFeedback({ type: 'error', message: 'Enter at least one valid score before saving.' });
      return;
    }

    try {
      const result = await recordBulk.mutateAsync({
        classroomId: selectedAssignment.classroom.classroomId,
        subjectId: selectedAssignment.subject.subjectId,
        semester,
        academicYear,
        records,
      });
      setFeedback({ type: 'success', message: `Saved grades for ${result.recordsSaved} student(s).` });
      setDraftScores({});
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Could not save grades.' });
    }
  }

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Enter grades</h1>
      <LedgerRule />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <SelectField
          label="Subject & classroom"
          className="min-w-[260px]"
          value={assignmentKey}
          onChange={(e) => setAssignmentKey(e.target.value)}
        >
          <option value="">Select…</option>
          {assignments?.map((a) => {
            const key = `${a.classroom.classroomId}:${a.subject.subjectId}`;
            return (
              <option key={key} value={key}>
                {a.subject.subjectName} — {a.classroom.className} {a.classroom.section} ({a.classroom.academicYear})
              </option>
            );
          })}
        </SelectField>

        <SelectField label="Semester" value={semester} onChange={(e) => setSemester(e.target.value as Semester)}>
          <option value="SEMESTER_1">Semester 1</option>
          <option value="SEMESTER_2">Semester 2</option>
        </SelectField>

        <TextField label="Academic year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
      </div>

      {!selectedAssignment ? (
        <EmptyState title="Select a subject and classroom to begin" />
      ) : isRosterLoading || gradesQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
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
                    Score (0–100)
                  </th>
                  <th className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase">
                    Letter grade
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
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={scoreFor(s.studentId)}
                        onChange={(e) => setScore(s.studentId, e.target.value)}
                        className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{existingLetterFor(s.studentId) ?? '—'}</td>
                    <td className="px-4 py-3">
                      {draftScores[s.studentId] !== undefined && draftScores[s.studentId] !== String(existingScoreFor(s.studentId) ?? '') ? (
                        <Badge tone="warning">Unsaved change</Badge>
                      ) : existingScoreFor(s.studentId) !== undefined ? (
                        <Badge tone="positive">Saved</Badge>
                      ) : (
                        <Badge>Not entered</Badge>
                      )}
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
            <Button onClick={() => void handleSubmit()} isLoading={recordBulk.isPending}>
              Save grades
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
