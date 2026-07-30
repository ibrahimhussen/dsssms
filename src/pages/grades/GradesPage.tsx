import { useState } from 'react';
import { useMyTeachingAssignments } from '../../hooks/useDashboardData';
import { useClassroomTotals, useDeleteGradeComponent, useGradeScheme } from '../../hooks/useGrades';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { AddGradeComponentModal } from './AddGradeComponentModal';
import { GradeEntryModal } from './GradeEntryModal';
import type { GradeCategory, GradeComponent, Semester } from '../../types/grade';

const CATEGORY_LABELS: Record<GradeCategory, string> = {
  QUIZ: 'Quiz',
  ASSIGNMENT: 'Assignment',
  TEST: 'Test',
  MID_EXAM: 'Mid Exam',
  FINAL_EXAM: 'Final Exam',
  OTHER: 'Other',
};

function currentAcademicYear(): string {
  const year = new Date().getFullYear();
  return `${year}/${String(year + 1).slice(2)}`;
}

export function GradesPage() {
  const { data: assignments } = useMyTeachingAssignments();
  const [teacherSubjectId, setTeacherSubjectId] = useState<string>('');
  const [semester, setSemester] = useState<Semester>('SEMESTER_1');
  const [academicYear, setAcademicYear] = useState<string>(currentAcademicYear());
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [entryComponentId, setEntryComponentId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GradeComponent | null>(null);

  const selectedAssignment = assignments?.find((a) => String(a.id) === teacherSubjectId);
  const scope = { teacherSubjectId: Number(teacherSubjectId), semester, academicYear };
  const hasScope = Boolean(teacherSubjectId && semester && academicYear);

  const { data: scheme, isLoading: isSchemeLoading } = useGradeScheme(hasScope ? scope : {});
  const { data: totals, isLoading: isTotalsLoading } = useClassroomTotals(hasScope ? scope : {});
  const deleteComponent = useDeleteGradeComponent();

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    await deleteComponent.mutateAsync(pendingDelete.gradeComponentId);
    setPendingDelete(null);
  }

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Enter grades</h1>
      <LedgerRule />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <SelectField
          label="Subject & classroom"
          className="min-w-[260px]"
          value={teacherSubjectId}
          onChange={(e) => setTeacherSubjectId(e.target.value)}
        >
          <option value="">Select…</option>
          {assignments?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.subject.subjectName} — {a.classroom.className} {a.classroom.section} ({a.classroom.academicYear})
            </option>
          ))}
        </SelectField>

        <SelectField label="Semester" value={semester} onChange={(e) => setSemester(e.target.value as Semester)}>
          <option value="SEMESTER_1">Semester 1</option>
          <option value="SEMESTER_2">Semester 2</option>
        </SelectField>

        <TextField label="Academic year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
      </div>

      {!selectedAssignment ? (
        <EmptyState title="Select a subject and classroom to begin" />
      ) : isSchemeLoading || !scheme ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={scheme.totalMaxMarks === 100 ? 'positive' : 'warning'}>
                {scheme.totalMaxMarks}/100 marks allocated
              </Badge>
              <Badge tone={scheme.hasFinalExam ? 'positive' : 'danger'}>
                {scheme.hasFinalExam ? 'Final Exam included' : 'Final Exam missing (mandatory)'}
              </Badge>
            </div>
            <Button onClick={() => setIsAddOpen(true)} disabled={scheme.remainingMarks <= 0}>
              Add component
            </Button>
          </div>

          {scheme.components.length === 0 ? (
            <EmptyState
              title="No grading scheme yet"
              description="Add components (Quiz, Assignment, Mid Exam, Final Exam…) that together total 100 marks."
            />
          ) : (
            <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              {scheme.components.map((c) => (
                <Card key={c.gradeComponentId}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge>{CATEGORY_LABELS[c.category]}</Badge>
                    <span className="text-sm font-semibold text-ink-900">/ {c.maxMarks}</span>
                  </div>
                  <p className="mb-3 font-display text-lg font-semibold text-ink-900">{c.name}</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setEntryComponentId(c.gradeComponentId)}>
                      Enter scores
                    </Button>
                    <Button variant="danger" onClick={() => setPendingDelete(c)}>
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <h2 className="mb-3 text-lg">Class totals</h2>
          {isTotalsLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !totals || totals.length === 0 ? (
            <EmptyState title="No students enrolled" description="This classroom has no enrolled students yet." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase">
                      Student
                    </th>
                    <th className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {totals.map((t) => (
                    <tr key={t.studentId} className="border-b border-paper-100 last:border-b-0">
                      <td className="px-4 py-3">{t.studentName}</td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {t.totalScore} / {t.totalMaxMarks}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {hasScope && (
        <AddGradeComponentModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          scope={scope}
          remainingMarks={scheme?.remainingMarks ?? 100}
          hasFinalExam={scheme?.hasFinalExam ?? false}
        />
      )}

      <GradeEntryModal gradeComponentId={entryComponentId} onClose={() => setEntryComponentId(null)} />

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Delete grade component"
        message={`Delete "${pendingDelete?.name}"? This removes every student's score for it too.`}
        confirmLabel="Delete"
        isLoading={deleteComponent.isPending}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
