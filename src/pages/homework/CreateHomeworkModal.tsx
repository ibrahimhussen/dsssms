import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { useMyTeachingAssignments } from '../../hooks/useDashboardData';
import { useCreateHomework } from '../../hooks/useHomework';

interface CreateHomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CreateHomeworkModal({ isOpen, onClose }: CreateHomeworkModalProps) {
  const { data: assignments } = useMyTeachingAssignments();
  const createHomework = useCreateHomework();

  const [teacherSubjectId, setTeacherSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTeacherSubjectId('');
    setTitle('');
    setDescription('');
    setDueDate('');
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!teacherSubjectId || !title.trim() || !dueDate) {
      setError('Please fill in the class, title, and due date.');
      return;
    }

    try {
      await createHomework.mutateAsync({
        teacherSubjectId: Number(teacherSubjectId),
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the assignment.');
    }
  }

  return (
    <Modal title="New assignment" isOpen={isOpen} onClose={handleClose} widthClassName="max-w-[520px]">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <SelectField label="Class" value={teacherSubjectId} onChange={(e) => setTeacherSubjectId(e.target.value)}>
          <option value="">Select a subject &amp; classroom…</option>
          {assignments?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.subject.subjectName} — {a.classroom.className} {a.classroom.section}
            </option>
          ))}
        </SelectField>

        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />

        <TextField
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />

        <TextField
          label="Due date"
          type="date"
          min={todayIsoDate()}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        {error && (
          <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={createHomework.isPending}>
            Create assignment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
