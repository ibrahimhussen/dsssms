import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useComponentRoster, useRecordComponentEntries } from '../../hooks/useGrades';

interface GradeEntryModalProps {
  gradeComponentId: number | null;
  onClose: () => void;
}

export function GradeEntryModal({ gradeComponentId, onClose }: GradeEntryModalProps) {
  const { data, isLoading, error } = useComponentRoster(gradeComponentId ?? undefined);
  const recordEntries = useRecordComponentEntries();

  const [scores, setScores] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error'>('success');

  // Seed scores from existing data whenever the component roster loads or changes
  useEffect(() => {
    if (data) {
      setScores(
        Object.fromEntries(
          data.roster.map((r) => [r.studentId, r.score !== null ? String(r.score) : ''])
        )
      );
      setFeedback(null);
    }
  }, [data]);

  const maxMarks = data?.component.maxMarks ?? 0;

  /** Returns a validation error string for a raw score value, or null if valid. */
  function validateScore(raw: string): string | null {
    if (raw === '' || raw === null) return null; // blank = not entered, not invalid
    const n = Number(raw);
    if (!Number.isFinite(n)) return 'Must be a number';
    if (n < 0) return 'Cannot be negative';
    if (n > maxMarks) return `Max is ${maxMarks}`;
    return null;
  }

  const hasValidationErrors = Object.values(scores).some((v) => validateScore(v) !== null);

  async function handleSave() {
    if (!gradeComponentId || !data) return;
    if (hasValidationErrors) {
      setFeedback('Fix validation errors before saving.');
      setFeedbackTone('error');
      return;
    }

    setFeedback(null);

    const records = Object.entries(scores)
      .map(([studentId, raw]) => {
        if (raw === '') return null;
        const score = Number(raw);
        return Number.isFinite(score) ? { studentId: Number(studentId), score } : null;
      })
      .filter((r): r is { studentId: number; score: number } => r !== null);

    if (records.length === 0) {
      setFeedback('Enter at least one score before saving.');
      setFeedbackTone('error');
      return;
    }

    try {
      const result = await recordEntries.mutateAsync({ gradeComponentId, input: { records } });
      setFeedback(`Saved scores for ${result.recordsSaved} student(s).`);
      setFeedbackTone('success');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Could not save scores. Please try again.');
      setFeedbackTone('error');
    }
  }

  // ── Modal title ────────────────────────────────────────────────────────────
  const modalTitle = data
    ? `${data.component.name} (out of ${data.component.maxMarks})`
    : 'Enter scores';

  // ── Body content ───────────────────────────────────────────────────────────

  let body: React.ReactNode;

  if (isLoading) {
    body = (
      <div className="flex items-center gap-2 py-8 text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
        <span className="text-sm">Loading student roster…</span>
      </div>
    );
  } else if (error) {
    body = (
      <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3">
        <p className="text-sm font-semibold text-danger-700">Could not load roster</p>
        <p className="mt-0.5 text-sm text-danger-600">
          {error instanceof Error ? error.message : 'An unexpected error occurred. Please close and try again.'}
        </p>
      </div>
    );
  } else if (!data) {
    // Should not happen but defend against it
    body = <p className="py-6 text-center text-sm text-slate-400">No data available.</p>;
  } else if (data.roster.length === 0) {
    body = (
      <div className="rounded-lg border border-gold-200 bg-gold-50 px-4 py-4 text-center">
        <p className="font-semibold text-gold-700">No students enrolled</p>
        <p className="mt-1 text-sm text-gold-600">
          This classroom has no enrolled students for the selected academic year.
          Students must be enrolled before scores can be entered.
        </p>
      </div>
    );
  } else {
    body = (
      <>
        {/* Component context */}
        <p className="mb-3 text-xs text-slate-500">
          {data.component.semester.replace('_', ' ')} · {data.component.academicYear} ·{' '}
          {data.roster.length} student{data.roster.length !== 1 ? 's' : ''}
        </p>

        {/* Column headers */}
        <div className="mb-1 flex items-center justify-between px-3 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
          <span>Student</span>
          <span>Score (max {data.component.maxMarks})</span>
        </div>

        {/* Roster — scrollable for large classes */}
        <ul
          className="mb-4 flex flex-col gap-1.5 overflow-y-auto"
          style={{ maxHeight: '55vh' }}
          role="list"
          aria-label="Student score list"
        >
          {data.roster.map((r) => {
            const raw = scores[r.studentId] ?? '';
            const validationError = validateScore(raw);
            return (
              <li
                key={r.studentId}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                  validationError ? 'border-danger-200 bg-danger-50/50' : 'border-paper-100'
                }`}
              >
                <span className="flex-1 text-sm text-ink-900">{r.studentName}</span>
                <div className="flex flex-col items-end gap-0.5">
                  <input
                    type="number"
                    min={0}
                    max={data.component.maxMarks}
                    step={0.5}
                    value={raw}
                    placeholder="—"
                    aria-label={`Score for ${r.studentName}`}
                    onChange={(e) => {
                      setScores((prev) => ({ ...prev, [r.studentId]: e.target.value }));
                      setFeedback(null);
                    }}
                    className={`w-24 rounded-lg border px-2.5 py-1.5 text-right text-sm focus:outline-none focus:ring-2 ${
                      validationError
                        ? 'border-danger-400 bg-danger-50 focus:border-danger-500 focus:ring-danger-200'
                        : 'border-slate-200 focus:border-pine-700 focus:ring-pine-700/20'
                    }`}
                  />
                  {validationError && (
                    <span className="text-[0.65rem] text-danger-600" role="alert">
                      {validationError}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Feedback */}
        {feedback && (
          <p
            className={`mb-4 rounded-lg px-3 py-2.5 text-sm ${
              feedbackTone === 'success'
                ? 'bg-pine-50 text-pine-800'
                : 'bg-danger-50 text-danger-700'
            }`}
            role="status"
            aria-live="polite"
          >
            {feedback}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => void handleSave()}
            isLoading={recordEntries.isPending}
            disabled={hasValidationErrors}
          >
            Save scores
          </Button>
        </div>
      </>
    );
  }

  return (
    <Modal
      title={modalTitle}
      isOpen={Boolean(gradeComponentId)}
      onClose={onClose}
      widthClassName="max-w-[540px]"
    >
      {body}
    </Modal>
  );
}
