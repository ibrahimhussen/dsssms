import { useEffect, useState } from 'react';
import { useMyTeachingAssignments } from '../../hooks/useDashboardData';
import { useClassroomTotals, useDeleteGradeComponent, useGradeScheme, useReleaseGradeComponent } from '../../hooks/useGrades';
import { useSubmitForReview, useSubjectFinalization } from '../../hooks/useFinalization';
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

export function GradesPage() {
  const { data: assignments } = useMyTeachingAssignments();
  const [teacherSubjectId, setTeacherSubjectId] = useState<string>('');
  const [semester, setSemester] = useState<Semester>('SEMESTER_1');
  const [academicYear, setAcademicYear] = useState<string>('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [entryComponentId, setEntryComponentId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GradeComponent | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const selectedAssignment = assignments?.find((a) => String(a.id) === teacherSubjectId);

  // Derive academic year from the selected assignment's classroom so it
  // always matches the DB-stored value (e.g. "2026" not clock-based "2026/27").
  useEffect(() => {
    if (selectedAssignment) {
      setAcademicYear(selectedAssignment.classroom.academicYear);
    }
  }, [selectedAssignment]);
  const scope = { teacherSubjectId: Number(teacherSubjectId), semester, academicYear };
  const hasScope = Boolean(teacherSubjectId && semester && academicYear);

  const { data: scheme, isLoading: isSchemeLoading } = useGradeScheme(hasScope ? scope : {});
  const { data: totals, isLoading: isTotalsLoading } = useClassroomTotals(hasScope ? scope : {});
  const deleteComponent  = useDeleteGradeComponent();
  const releaseComponent = useReleaseGradeComponent();
  const submitForReview  = useSubmitForReview();

  // Load current finalization status for the selected subject
  const { data: finalizationStatus } = useSubjectFinalization(
    Number(teacherSubjectId),
    semester,
    academicYear
  );

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    await deleteComponent.mutateAsync(pendingDelete.gradeComponentId);
    setPendingDelete(null);
  }

  async function handleSubmitForReview() {
    if (!teacherSubjectId || !semester || !academicYear) return;
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await submitForReview.mutateAsync({
        teacherSubjectId: Number(teacherSubjectId),
        semester,
        academicYear,
      });
      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submit failed.');
    }
  }

  // Determine whether the submit button should be shown and what state it's in
  const currentStatus = finalizationStatus?.status ?? 'DRAFT';
  const canSubmit = hasScope && currentStatus === 'DRAFT' && (scheme?.totalMaxMarks ?? 0) === 100 && (scheme?.hasFinalExam ?? false);

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
                    <div className="flex items-center gap-2">
                      <Badge tone={c.isReleased ? 'positive' : 'neutral'}>
                        {c.isReleased ? 'Released' : 'Not Released'}
                      </Badge>
                      <span className="text-sm font-semibold text-ink-900">/ {c.maxMarks}</span>
                    </div>
                  </div>
                  <p className="mb-3 font-display text-lg font-semibold text-ink-900">{c.name}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => setEntryComponentId(c.gradeComponentId)}>
                      Enter scores
                    </Button>
                    {!c.isReleased && (
                      <Button
                        variant="secondary"
                        isLoading={releaseComponent.isPending && releaseComponent.variables === c.gradeComponentId}
                        onClick={() => releaseComponent.mutate(c.gradeComponentId)}
                      >
                        Release results
                      </Button>
                    )}
                    {!c.isReleased && (
                      <Button variant="danger" onClick={() => setPendingDelete(c)}>
                        Delete
                      </Button>
                    )}
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
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase">
                      Student
                    </th>
                    {scheme.components.map((c) => (
                      <th
                        key={c.gradeComponentId}
                        className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase"
                      >
                        {c.name}
                        <span className="ml-1 font-normal normal-case text-slate-500">/ {c.maxMarks}</span>
                      </th>
                    ))}
                    <th className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {totals.map((t) => (
                    <tr key={t.studentId} className="border-b border-paper-100 last:border-b-0">
                      <td className="px-4 py-3 whitespace-nowrap">{t.studentName}</td>
                      {scheme.components.map((c) => {
                        const cell = t.componentScores.find((cs) => cs.gradeComponentId === c.gradeComponentId);
                        return (
                          <td key={c.gradeComponentId} className="px-4 py-3 font-mono text-sm">
                            {cell?.score ?? '—'}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 font-mono text-sm font-semibold">
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

      {/* -- Submit for Review -------------------------------------------------- */}
      {hasScope && selectedAssignment && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-ink-900">Submit for Review</h2>
          <p className="mb-4 text-sm text-slate-500">
            Once all marks are entered and the grading scheme totals 100 marks, submit your results for
            Vice Director review.
          </p>

          {/* Status badge */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-slate-600">Current status:</span>
            {currentStatus === 'DRAFT'        && <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-600">Draft</span>}
            {currentStatus === 'UNDER_REVIEW' && <span className="rounded-full bg-gold-100 px-3 py-0.5 text-xs font-semibold text-gold-700">Under Review</span>}
            {currentStatus === 'APPROVED'     && <span className="rounded-full bg-pine-100 px-3 py-0.5 text-xs font-semibold text-pine-700">Approved</span>}
            {currentStatus === 'FINALIZED'    && <span className="rounded-full bg-pine-100 px-3 py-0.5 text-xs font-semibold text-pine-700">Finalized</span>}
          </div>

          {/* Correction reason — shown when results were returned */}
          {currentStatus === 'DRAFT' && finalizationStatus?.correctionReason && (
            <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2.5">
              <p className="text-sm font-semibold text-danger-700">Returned for correction:</p>
              <p className="mt-0.5 text-sm text-danger-600">{finalizationStatus.correctionReason}</p>
            </div>
          )}

          {submitError && (
            <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{submitError}</p>
          )}
          {submitSuccess && (
            <p className="mb-3 rounded-lg bg-pine-50 px-3 py-2 text-sm text-pine-700">
              ✓ Results submitted for review successfully.
            </p>
          )}

          {currentStatus === 'DRAFT' && (
            <>
              {!canSubmit && (
                <p className="mb-3 text-sm text-slate-500">
                  {(scheme?.totalMaxMarks ?? 0) < 100
                    ? `Grading scheme is ${scheme?.totalMaxMarks ?? 0}/100 marks — add components to reach 100 before submitting.`
                    : !scheme?.hasFinalExam
                    ? 'A Final Exam component (mandatory) is missing.'
                    : 'Select a subject to submit.'}
                </p>
              )}
              <Button
                onClick={() => void handleSubmitForReview()}
                isLoading={submitForReview.isPending}
                disabled={!canSubmit}
              >
                Submit for Review
              </Button>
            </>
          )}

          {(currentStatus === 'UNDER_REVIEW' || currentStatus === 'APPROVED' || currentStatus === 'FINALIZED') && (
            <p className="text-sm text-slate-500 italic">
              {currentStatus === 'UNDER_REVIEW' && 'Your results are under review by the Vice Director.'}
              {currentStatus === 'APPROVED'     && 'Your results have been approved and are pending finalization.'}
              {currentStatus === 'FINALIZED'    && 'Your results are finalized and official.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
