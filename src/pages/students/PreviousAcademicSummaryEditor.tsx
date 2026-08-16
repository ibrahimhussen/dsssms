import { useState } from 'react';
import { MdAdd, MdDelete, MdExpandMore, MdExpandLess } from 'react-icons/md';

export interface PreviousSubjectMark {
  subjectName: string;
  mark: number | '';
  grade: string;
}

export interface PreviousAcademicSummary {
  subjects: PreviousSubjectMark[];
  overallAverage?: number | '';
  notes?: string;
}

interface Props {
  value: PreviousAcademicSummary | null;
  onChange: (v: PreviousAcademicSummary | null) => void;
}

const EMPTY_SUBJECT: PreviousSubjectMark = { subjectName: '', mark: '', grade: '' };

/**
 * Collapsible editor for recording a student's previous-grade academic
 * performance (e.g. Grade 8 results for a new Grade 9 admission).
 * This data is stored as `previousAcademicSummary` JSON on the Student
 * record and is kept completely separate from the current academic register.
 */
export function PreviousAcademicSummaryEditor({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const subjects = value?.subjects ?? [];
  const hasData = subjects.length > 0 || value?.overallAverage || value?.notes;

  function ensureValue(): PreviousAcademicSummary {
    return value ?? { subjects: [] };
  }

  function addRow() {
    const v = ensureValue();
    onChange({ ...v, subjects: [...v.subjects, { ...EMPTY_SUBJECT }] });
    setOpen(true);
  }

  function updateSubject(idx: number, field: keyof PreviousSubjectMark, raw: string) {
    const v = ensureValue();
    const updated = v.subjects.map((s, i) =>
      i === idx
        ? { ...s, [field]: field === 'mark' ? (raw === '' ? '' : Number(raw)) : raw }
        : s
    );
    onChange({ ...v, subjects: updated });
  }

  function removeSubject(idx: number) {
    const v = ensureValue();
    const updated = v.subjects.filter((_, i) => i !== idx);
    const next: PreviousAcademicSummary = { ...v, subjects: updated };
    if (updated.length === 0 && !next.overallAverage && !next.notes) {
      onChange(null);
    } else {
      onChange(next);
    }
  }

  function updateOverall(raw: string) {
    const v = ensureValue();
    onChange({ ...v, overallAverage: raw === '' ? '' : Number(raw) });
  }

  function updateNotes(notes: string) {
    const v = ensureValue();
    onChange({ ...v, notes: notes || undefined });
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-pine-700 hover:text-pine-900"
      >
        {open ? <MdExpandLess className="h-4 w-4" /> : <MdExpandMore className="h-4 w-4" />}
        Record previous academic performance
        {hasData && !open && (
          <span className="ml-1 rounded bg-pine-100 px-1.5 py-0.5 text-[0.75rem] font-semibold text-pine-700">
            {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
          </span>
        )}
      </button>
      <p className="mt-0.5 text-xs text-slate-400">
        Optional — store {'{'}e.g. Grade 8{'}'} results separately from current enrollment.
        These do not appear in the Academic Register.
      </p>

      {open && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          {/* Subject rows */}
          {subjects.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 grid grid-cols-[1fr_90px_80px_28px] gap-2 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
                <span>Subject</span>
                <span>Mark (/100)</span>
                <span>Grade/Letter</span>
                <span />
              </div>
              {subjects.map((s, i) => (
                <div key={i} className="mb-1.5 grid grid-cols-[1fr_90px_80px_28px] gap-2 items-center">
                  <input
                    type="text"
                    placeholder="e.g. Mathematics"
                    value={s.subjectName}
                    onChange={(e) => updateSubject(i, 'subjectName', e.target.value)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-pine-700 focus:outline-none focus:ring-1 focus:ring-pine-700/30"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="—"
                    value={s.mark}
                    onChange={(e) => updateSubject(i, 'mark', e.target.value)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-mono text-right focus:border-pine-700 focus:outline-none focus:ring-1 focus:ring-pine-700/30"
                  />
                  <input
                    type="text"
                    placeholder="A / Pass"
                    value={s.grade}
                    onChange={(e) => updateSubject(i, 'grade', e.target.value)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-pine-700 focus:outline-none focus:ring-1 focus:ring-pine-700/30"
                  />
                  <button
                    type="button"
                    onClick={() => removeSubject(i)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                    aria-label="Remove subject"
                  >
                    <MdDelete className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addRow}
            className="mb-3 flex items-center gap-1.5 text-[0.8125rem] font-medium text-pine-700 hover:text-pine-900"
          >
            <MdAdd className="h-4 w-4" />
            Add subject
          </button>

          {subjects.length > 0 && (
            <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
              <label className="text-[0.8125rem] text-slate-600 shrink-0">Overall average</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                placeholder="—"
                value={value?.overallAverage ?? ''}
                onChange={(e) => updateOverall(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-mono text-right focus:border-pine-700 focus:outline-none focus:ring-1 focus:ring-pine-700/30"
              />
            </div>
          )}

          <textarea
            rows={2}
            placeholder="Additional notes (optional)"
            value={value?.notes ?? ''}
            onChange={(e) => updateNotes(e.target.value)}
            className="mt-3 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-pine-700 focus:outline-none focus:ring-1 focus:ring-pine-700/30"
          />
        </div>
      )}
    </div>
  );
}
