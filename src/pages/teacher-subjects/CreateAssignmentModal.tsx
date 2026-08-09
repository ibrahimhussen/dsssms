import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { useCreateAssignment } from '../../hooks/useTeacherSubjects';
import { useTeacherOptions } from '../../hooks/useTeacherOptions';
import { useSubjectOptions } from '../../hooks/useSubjects';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { createAssignmentFormSchema } from '../../lib/validation/teacher-subject';
import type { CreateAssignmentFormValues } from '../../lib/validation/teacher-subject';

interface CreateAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateAssignmentModal({ isOpen, onClose, onCreated }: CreateAssignmentModalProps) {
  const createAssignment = useCreateAssignment();
  const { data: teachersData } = useTeacherOptions();
  const { data: subjectsData } = useSubjectOptions();
  const { data: classroomsData } = useClassroomOptions();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAssignmentFormValues>({ resolver: zodResolver(createAssignmentFormSchema) as any });

  async function onSubmit(values: CreateAssignmentFormValues) {
    setServerError(null);
    try {
      await createAssignment.mutateAsync(values);
      reset();
      onCreated();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not create the assignment.');
    }
  }

  function handleClose() {
    reset();
    setServerError(null);
    onClose();
  }

  return (
    <Modal title="Assign teacher to subject &amp; classroom" isOpen={isOpen} onClose={handleClose}>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <SelectField label="Teacher" error={errors.teacherId?.message} {...register('teacherId')}>
          <option value="">Select a teacher…</option>
          {teachersData?.items.map((t) => (
            <option key={t.userId} value={t.teacherId ?? undefined}>
              {t.fullName}
            </option>
          ))}
        </SelectField>

        <SelectField label="Subject" error={errors.subjectId?.message} {...register('subjectId')}>
          <option value="">Select a subject…</option>
          {subjectsData?.items.map((s) => (
            <option key={s.subjectId} value={s.subjectId}>
              {s.subjectName} ({s.subjectCode})
            </option>
          ))}
        </SelectField>

        <SelectField label="Classroom" error={errors.classroomId?.message} {...register('classroomId')}>
          <option value="">Select a classroom…</option>
          {classroomsData?.items.map((c) => (
            <option key={c.classroomId} value={c.classroomId}>
              {c.className} {c.section} ({c.academicYear})
            </option>
          ))}
        </SelectField>

        {serverError && (
          <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
            {serverError}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create assignment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
