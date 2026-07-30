import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useComponentRoster, useRecordComponentEntries } from '../../hooks/useGrades';

interface GradeEntryModalProps {
  gradeComponentId: number | null;
  onClose: () => void;
}

export function GradeEntryModal({ gradeComponentId, onClose }: GradeEntryModalProps) {
  const { data, isLoading } = useComponentRoster(gradeComponentId ?? undefined);
  const recordEntries = useRecordComponentEntries();

  const [scores, setScores] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setScores(Object.fromEntries(data.roster.map((r) => [r.studentId, r.score !== null ? String(r.score) : ''])));
      setFeedback(null);
    }
  }, [data]);

  async function handleSave() {
    if (!gradeComponentId || !data) return;
    setFeedback(null);

    const records = Object.entries(scores)
      .map(([studentId, raw]) => {
        const score = Number(raw);
        return raw !== '' && Number.isFinite(score) ? { studentId: Number(studentId), score } : null;
      })
      .filter((r): r is { studentId: number; score: number } => r !== null);

    if (records.length === 0) {
      setFeedback('Enter at least one valid score before saving.');
      return;
    }

    try {
      const result = await recordEntries.mutateAsync({ gradeComponentId, input: { records } });
      setFeedback(`Saved scores for ${result.recordsSaved} student(s).`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Could not save scores.');
    }
  }

  return (
    <Modal
      title={data ? `${data.component.name} (out of ${data.component.maxMarks})` : 'Enter scores'}
      isOpen={Boolean(gradeComponentId)}
      onClose={onClose}
      widthClassName="max-w-[520px]"
    >
      {isLoading || !data ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <ul className="mb-4 flex flex-col gap-2">
            {data.roster.map((r) => (
              <li key={r.studentId} className="flex items-center justify-between gap-3 rounded-lg border border-paper-100 px-3 py-2">
                <span className="text-sm text-ink-900">{r.studentName}</span>
                <input
                  type="number"
                  min={0}
                  max={data.component.maxMarks}
                  step={0.5}
                  value={scores[r.studentId] ?? ''}
                  onChange={(e) => setScores((prev) => ({ ...prev, [r.studentId]: e.target.value }))}
                  className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                />
              </li>
            ))}
          </ul>

          {feedback && (
            <p className="mb-4 rounded-lg bg-paper-100 px-3 py-2.5 text-sm text-ink-700" role="status">
              {feedback}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => void handleSave()} isLoading={recordEntries.isPending}>
              Save scores
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
