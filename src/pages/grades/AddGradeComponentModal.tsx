import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { useCreateGradeComponent } from '../../hooks/useGrades';
import type { GradeCategory, GradeComponentQuery } from '../../types/grade';

const CATEGORY_OPTIONS: { value: GradeCategory; label: string; suggestedName: string }[] = [
  { value: 'QUIZ', label: 'Quiz', suggestedName: 'Quiz' },
  { value: 'ASSIGNMENT', label: 'Assignment', suggestedName: 'Assignment' },
  { value: 'TEST', label: 'Test', suggestedName: 'Test' },
  { value: 'MID_EXAM', label: 'Mid Exam', suggestedName: 'Mid Exam' },
  { value: 'FINAL_EXAM', label: 'Final Exam', suggestedName: 'Final Exam' },
  { value: 'OTHER', label: 'Custom…', suggestedName: '' },
];

interface AddGradeComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: GradeComponentQuery;
  remainingMarks: number;
  hasFinalExam: boolean;
}

export function AddGradeComponentModal({ isOpen, onClose, scope, remainingMarks, hasFinalExam }: AddGradeComponentModalProps) {
  const createComponent = useCreateGradeComponent();

  const [category, setCategory] = useState<GradeCategory>('QUIZ');
  const [name, setName] = useState('Quiz');
  const [maxMarks, setMaxMarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCategory('QUIZ');
    setName('Quiz');
    setMaxMarks('');
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleCategoryChange(next: GradeCategory) {
    setCategory(next);
    if (next === 'FINAL_EXAM') {
      setName('Final Exam');
      setMaxMarks('50');
    } else {
      const suggestion = CATEGORY_OPTIONS.find((c) => c.value === next)?.suggestedName ?? '';
      setName(suggestion);
      setMaxMarks('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (category === 'FINAL_EXAM' && hasFinalExam) {
      setError('A Final Exam component already exists for this subject and semester.');
      return;
    }

    const marks = Number(maxMarks);
    if (!name.trim() || !maxMarks || !Number.isFinite(marks) || marks <= 0) {
      setError('Please enter a name and a positive number of marks.');
      return;
    }
    if (category === 'FINAL_EXAM' && marks !== 50) {
      setError('Final Exam must be worth exactly 50 marks.');
      return;
    }
    if (marks > remainingMarks) {
      setError(`Only ${remainingMarks} mark(s) remain in this scheme (out of 100).`);
      return;
    }

    try {
      await createComponent.mutateAsync({ ...scope, category, name: name.trim(), maxMarks: marks });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this component.');
    }
  }

  return (
    <Modal title="Add grade component" isOpen={isOpen} onClose={handleClose} widthClassName="max-w-[440px]">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <SelectField label="Category" value={category} onChange={(e) => handleCategoryChange(e.target.value as GradeCategory)}>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value} disabled={c.value === 'FINAL_EXAM' && hasFinalExam}>
              {c.label}
              {c.value === 'FINAL_EXAM' && hasFinalExam ? ' (already added)' : ''}
            </option>
          ))}
        </SelectField>

        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />

        <TextField
          label="Max marks"
          type="number"
          min={1}
          max={category === 'FINAL_EXAM' ? 50 : remainingMarks}
          value={maxMarks}
          disabled={category === 'FINAL_EXAM'}
          onChange={(e) => setMaxMarks(e.target.value)}
        />
        <p className="mb-4 -mt-3 text-[0.8125rem] text-slate-500">
          {category === 'FINAL_EXAM' ? 'Final Exam is always worth 50 marks.' : `${remainingMarks} mark(s) remaining out of 100.`}
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={createComponent.isPending}>
            Add component
          </Button>
        </div>
      </form>
    </Modal>
  );
}
