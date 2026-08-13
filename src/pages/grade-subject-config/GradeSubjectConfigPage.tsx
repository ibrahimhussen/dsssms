import { useState } from 'react';
import {
  MdAdd,
  MdDelete,
  MdContentCopy,
  MdCheckCircle,
  MdWarningAmber,
  MdDragIndicator,
} from 'react-icons/md';
import {
  useConfiguredGrades,
  useGradeSubjectConfig,
  useUpsertGradeSubjectConfig,
  useRemoveGradeSubjectConfig,
  useCopyFromYear,
} from '../../hooks/useGradeSubjectConfig';
import { useSubjectOptions } from '../../hooks/useSubjects';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import type { GradeSubjectConfig } from '../../types/grade-subject-config';

// ── Grade list used for the class-name dropdown ───────────────────────────────

const GRADE_OPTIONS = [
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
];

function currentAcademicYear(): string {
  const y = new Date().getFullYear();
  return `${y}/${String(y + 1).slice(2)}`;
}

// ── Copy-from-year modal ──────────────────────────────────────────────────────

interface CopyModalProps {
  isOpen: boolean;
  targetClassName: string;
  targetAcademicYear: string;
  onClose: () => void;
}

function CopyFromYearModal({
  isOpen,
  targetClassName,
  targetAcademicYear,
  onClose,
}: CopyModalProps) {
  const copyFromYear = useCopyFromYear();
  const [sourceYear, setSourceYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  async function handleCopy(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceYear.trim()) return;
    setError(null);
    setResult(null);
    try {
      const res = await copyFromYear.mutateAsync({
        className: targetClassName,
        sourceAcademicYear: sourceYear.trim(),
        targetAcademicYear,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copy failed. Please try again.');
    }
  }

  function handleClose() {
    setSourceYear('');
    setError(null);
    setResult(null);
    onClose();
  }

  return (
    <Modal
      title={`Copy from previous year — ${targetClassName}`}
      isOpen={isOpen}
      onClose={handleClose}
      widthClassName="max-w-[460px]"
    >
      {result ? (
        <div className="text-center py-4">
          <MdCheckCircle className="h-10 w-10 text-pine-600 mx-auto mb-3" />
          <p className="font-semibold text-ink-900">Copy complete</p>
          <p className="mt-1 text-sm text-slate-500">
            {result.created} subject{result.created !== 1 ? 's' : ''} added to{' '}
            <strong>{targetAcademicYear}</strong>.
            {result.skipped > 0 && ` ${result.skipped} already existed and were skipped.`}
          </p>
          <Button className="mt-5" onClick={handleClose}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void handleCopy(e)} noValidate>
          <p className="mb-4 text-sm text-ink-700">
            Copy the entire subject list for{' '}
            <strong>{targetClassName}</strong> from a previous academic year into{' '}
            <strong>{targetAcademicYear}</strong>. Subjects that already exist in the
            target year will be skipped.
          </p>
          <TextField
            label="Source academic year"
            placeholder="e.g. 2025/26"
            value={sourceYear}
            onChange={(e) => setSourceYear(e.target.value)}
          />
          {error && <ErrorMessage error={new Error(error)} className="mb-3" />}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={copyFromYear.isPending}
              disabled={!sourceYear.trim()}
            >
              <MdContentCopy className="h-4 w-4" />
              Copy subjects
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ── Add subject modal ─────────────────────────────────────────────────────────

interface AddSubjectModalProps {
  isOpen: boolean;
  className: string;
  academicYear: string;
  existingSubjectIds: Set<number>;
  onClose: () => void;
}

function AddSubjectModal({
  isOpen,
  className,
  academicYear,
  existingSubjectIds,
  onClose,
}: AddSubjectModalProps) {
  const { data: subjectsData } = useSubjectOptions();
  const upsert = useUpsertGradeSubjectConfig();
  const [subjectId, setSubjectId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const availableSubjects = (subjectsData?.items ?? []).filter(
    (s) => !existingSubjectIds.has(s.subjectId)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId) return;
    setError(null);
    try {
      await upsert.mutateAsync({
        className,
        academicYear,
        subjectId: Number(subjectId),
        sortOrder: existingSubjectIds.size,
      });
      setSubjectId('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add subject.');
    }
  }

  function handleClose() {
    setSubjectId('');
    setError(null);
    onClose();
  }

  return (
    <Modal
      title={`Add required subject — ${className} (${academicYear})`}
      isOpen={isOpen}
      onClose={handleClose}
      widthClassName="max-w-[440px]"
    >
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        {availableSubjects.length === 0 ? (
          <p className="mb-4 text-sm text-slate-500">
            All subjects from the catalog are already configured for this grade and year.
            Add new subjects to the Subject catalog first.
          </p>
        ) : (
          <>
            <SelectField
              label="Subject"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">Select a subject from the catalog…</option>
              {availableSubjects.map((s) => (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.subjectName} ({s.subjectCode})
                </option>
              ))}
            </SelectField>
            <p className="mb-4 -mt-3 text-xs text-slate-500">
              Only subjects already in the Subject catalog can be added.
              To add a new subject, go to the Subjects page first.
            </p>
          </>
        )}

        {error && <ErrorMessage error={new Error(error)} className="mb-3" />}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          {availableSubjects.length > 0 && (
            <Button
              type="submit"
              isLoading={upsert.isPending}
              disabled={!subjectId}
            >
              <MdAdd className="h-4 w-4" />
              Add subject
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

// ── Configured-grades overview panel ─────────────────────────────────────────

interface ConfiguredGradesPanelProps {
  selected: { className: string; academicYear: string } | null;
  onSelect: (className: string, academicYear: string) => void;
}

function ConfiguredGradesPanel({ selected, onSelect }: ConfiguredGradesPanelProps) {
  const { data, isLoading, error } = useConfiguredGrades();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700" />
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-danger-600">
        {error instanceof Error ? error.message : 'Failed to load configured grades.'}
      </p>
    );
  }

  const list = data ?? [];

  if (list.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        No grades configured yet. Use the form on the right to set up the first one.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {list.map((g) => {
        const isSelected =
          selected?.className === g.className && selected?.academicYear === g.academicYear;
        return (
          <li key={`${g.className}-${g.academicYear}`}>
            <button
              type="button"
              onClick={() => onSelect(g.className, g.academicYear)}
              className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? 'bg-pine-900 text-paper-50'
                  : 'hover:bg-paper-100 text-ink-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{g.className}</span>
                <Badge tone={isSelected ? 'neutral' : 'positive'}>
                  {g.subjectCount} subject{g.subjectCount !== 1 ? 's' : ''}
                </Badge>
              </div>
              <p className={`text-xs mt-0.5 ${isSelected ? 'text-paper-200' : 'text-slate-500'}`}>
                {g.academicYear}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ── Subject list for selected grade ──────────────────────────────────────────

interface SubjectListProps {
  className: string;
  academicYear: string;
}

function SubjectList({ className, academicYear }: SubjectListProps) {
  const { data, isLoading, error, refetch } = useGradeSubjectConfig(className, academicYear);
  const remove = useRemoveGradeSubjectConfig(className, academicYear);
  const [pendingRemove, setPendingRemove] = useState<GradeSubjectConfig | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isAddOpen, setAddOpen] = useState(false);
  const [isCopyOpen, setCopyOpen] = useState(false);

  const existingSubjectIds = new Set((data ?? []).map((s) => s.subjectId));

  async function handleRemoveConfirm() {
    if (!pendingRemove) return;
    setRemoveError(null);
    try {
      await remove.mutateAsync(pendingRemove.id);
      setPendingRemove(null);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Could not remove subject.');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700" />
        Loading subjects…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
        <p className="text-sm text-danger-700">
          {error instanceof Error ? error.message : 'Failed to load subjects.'}
        </p>
        <Button variant="ghost" className="mt-2" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Action bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            {className}{' '}
            <span className="text-slate-500 font-normal text-base">— {academicYear}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {(data ?? []).length} required subject{(data ?? []).length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setCopyOpen(true)}
            title="Copy subject list from a previous academic year"
          >
            <MdContentCopy className="h-4 w-4" />
            Copy from year
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <MdAdd className="h-4 w-4" />
            Add subject
          </Button>
        </div>
      </div>

      {removeError && (
        <ErrorMessage error={new Error(removeError)} className="mb-3" />
      )}

      {/* Subject rows */}
      {(data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
          <p className="font-medium text-slate-600">No subjects configured</p>
          <p className="mt-1 text-sm text-slate-500">
            Add the required subjects for this grade and academic year.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => setCopyOpen(true)}>
              <MdContentCopy className="h-4 w-4" />
              Copy from previous year
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <MdAdd className="h-4 w-4" />
              Add first subject
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase w-8" />
                <th className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase">
                  Subject
                </th>
                <th className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase">
                  Code
                </th>
                <th className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase">
                  Order
                </th>
                <th className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase">
                  Status
                </th>
                <th className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((subject, idx) => (
                <tr
                  key={subject.id}
                  className="border-b border-paper-100 last:border-b-0 hover:bg-paper-50"
                >
                  <td className="px-3 py-3 text-slate-300">
                    <MdDragIndicator className="h-4 w-4" />
                  </td>
                  <td className="px-4 py-3 font-medium text-ink-900">
                    {subject.subjectName}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {subject.subjectCode}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="positive">Required</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      onClick={() => setPendingRemove(subject)}
                      title="Remove from this grade's required subjects"
                    >
                      <MdDelete className="h-4 w-4 text-danger-500" />
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Note about TeacherSubject separation */}
      {(data ?? []).length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <MdWarningAmber className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
          <p className="text-xs text-slate-600">
            These subjects are <strong>required</strong> for the Academic Register regardless of
            teacher assignment. A subject with no teacher assigned will appear in the register
            as incomplete — not missing.
          </p>
        </div>
      )}

      {/* Modals */}
      <AddSubjectModal
        isOpen={isAddOpen}
        className={className}
        academicYear={academicYear}
        existingSubjectIds={existingSubjectIds}
        onClose={() => setAddOpen(false)}
      />

      <CopyFromYearModal
        isOpen={isCopyOpen}
        targetClassName={className}
        targetAcademicYear={academicYear}
        onClose={() => setCopyOpen(false)}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingRemove)}
        title="Remove required subject"
        message={
          removeError ??
          `Remove "${pendingRemove?.subjectName}" from the required subjects for ${className} in ${academicYear}? This will affect the Academic Register for this grade and year.`
        }
        confirmLabel="Remove"
        isDangerous
        isLoading={remove.isPending}
        onConfirm={() => void handleRemoveConfirm()}
        onCancel={() => {
          setPendingRemove(null);
          setRemoveError(null);
        }}
      />
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function GradeSubjectConfigPage() {
  const { data: settings } = useSystemSettings();
  const defaultYear = settings?.currentAcademicYear ?? currentAcademicYear();

  // Panel selection state
  const [selected, setSelected] = useState<{ className: string; academicYear: string } | null>(null);

  // New grade setup form
  const [newClassName, setNewClassName] = useState('Grade 9');
  const [newAcademicYear, setNewAcademicYear] = useState(defaultYear);
  const upsert = useUpsertGradeSubjectConfig();
  const [setupError, setSetupError] = useState<string | null>(null);

  function handleSelect(className: string, academicYear: string) {
    setSelected({ className, academicYear });
  }

  // Quick-init: if admin types a grade+year that isn't configured yet and
  // clicks "Open", we just navigate the right panel — no DB write needed
  // until they actually add a subject.
  function handleOpenGrade(e: React.FormEvent) {
    e.preventDefault();
    setSetupError(null);
    if (!newClassName || !newAcademicYear.trim()) {
      setSetupError('Please select a grade and enter an academic year.');
      return;
    }
    setSelected({ className: newClassName, academicYear: newAcademicYear.trim() });
  }

  return (
    <div className="max-w-full">
      <div className="mb-1">
        <h1 className="text-2xl">Grade Subject Configuration</h1>
        <p className="mt-1 text-sm text-slate-500">
          Define which subjects are required for each grade and academic year.
          This is the authoritative source for the Academic Register — not teacher assignments.
        </p>
      </div>
      <LedgerRule />

      <div className="grid grid-cols-[260px_1fr] gap-6 max-[900px]:grid-cols-1">
        {/* ── Left panel — configured grades list + setup form ── */}
        <div className="flex flex-col gap-5">
          {/* Existing configured grades */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Configured grades
            </h2>
            <ConfiguredGradesPanel selected={selected} onSelect={handleSelect} />
          </div>

          {/* Open a new grade/year combination */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Open grade
            </h2>
            <form onSubmit={handleOpenGrade} noValidate>
              <SelectField
                label="Grade"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Academic year"
                placeholder="e.g. 2026/27"
                value={newAcademicYear}
                onChange={(e) => setNewAcademicYear(e.target.value)}
              />
              {setupError && (
                <p className="mb-3 text-xs text-danger-600">{setupError}</p>
              )}
              <Button type="submit" className="w-full">
                Open
              </Button>
            </form>
          </div>
        </div>

        {/* ── Right panel — subject list for selected grade ── */}
        <div className="min-w-0">
          {selected ? (
            <SubjectList
              className={selected.className}
              academicYear={selected.academicYear}
            />
          ) : (
            <EmptyState
              title="Select a grade to manage its subjects"
              description="Choose a configured grade from the list, or use the form to open a grade and academic year combination."
            />
          )}
        </div>
      </div>
    </div>
  );
}
