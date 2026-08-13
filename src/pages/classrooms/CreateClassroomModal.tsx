import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { useCreateClassroom } from '../../hooks/useClassrooms';
import { useTeacherOptions } from '../../hooks/useTeacherOptions';
import { createClassroomFormSchema } from '../../lib/validation/classroom';
import type { CreateClassroomFormValues } from '../../lib/validation/classroom';

interface CreateClassroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateClassroomModal({ isOpen, onClose, onCreated }: CreateClassroomModalProps) {
  const createClassroom = useCreateClassroom();
  const { data: teachersData } = useTeacherOptions();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateClassroomFormValues>({ resolver: zodResolver(createClassroomFormSchema) as any });

  async function onSubmit(values: CreateClassroomFormValues) {
    setServerError(null);
    try {
      await createClassroom.mutateAsync({
        className: values.className,
        section: values.section,
        academicYear: values.academicYear,
        session: values.session,
        homeroomTeacherId: values.homeroomTeacherId || undefined,
      });
      reset();
      onCreated();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not create the classroom.');
    }
  }

  function handleClose() {
    reset();
    setServerError(null);
    onClose();
  }

  return (
    <Modal title="Add classroom" isOpen={isOpen} onClose={handleClose}>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <div className="grid grid-cols-2 gap-x-4">
          <TextField label="Class name" placeholder="e.g. Grade 9" error={errors.className?.message} {...register('className')} />
          <TextField label="Section" placeholder="e.g. A" error={errors.section?.message} {...register('section')} />
        </div>

        <TextField
          label="Academic year"
          placeholder="e.g. 2025/26"
          error={errors.academicYear?.message}
          {...register('academicYear')}
        />

        <SelectField label="Class session" error={errors.session?.message} {...register('session')}>
          <option value="MORNING">☀️ Morning Session (2:00 – 6:15 Local)</option>
          <option value="AFTERNOON">🌤️ Afternoon Session (6:30 – 10:45 Local)</option>
        </SelectField>

        <SelectField label="Homeroom teacher (optional)" error={errors.homeroomTeacherId?.message} {...register('homeroomTeacherId')}>
          <option value="">None assigned</option>
          {teachersData?.items.filter(t => t.teacherId).map((t) => (
            <option key={t.teacherId} value={t.teacherId}>
              {t.fullName}
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
            Create classroom
          </Button>
        </div>
      </form>
    </Modal>
  );
}
