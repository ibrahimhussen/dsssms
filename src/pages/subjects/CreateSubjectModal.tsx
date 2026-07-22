import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { useCreateSubject } from '../../hooks/useSubjects';
import { createSubjectFormSchema } from '../../lib/validation/subject';
import type { CreateSubjectFormValues } from '../../lib/validation/subject';

interface CreateSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateSubjectModal({ isOpen, onClose, onCreated }: CreateSubjectModalProps) {
  const createSubject = useCreateSubject();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSubjectFormValues>({ resolver: zodResolver(createSubjectFormSchema) });

  async function onSubmit(values: CreateSubjectFormValues) {
    setServerError(null);
    try {
      await createSubject.mutateAsync(values);
      reset();
      onCreated();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not create the subject.');
    }
  }

  function handleClose() {
    reset();
    setServerError(null);
    onClose();
  }

  return (
    <Modal title="Add subject" isOpen={isOpen} onClose={handleClose}>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <TextField label="Subject code" placeholder="e.g. MATH9" error={errors.subjectCode?.message} {...register('subjectCode')} />
        <TextField label="Subject name" placeholder="e.g. Mathematics" error={errors.subjectName?.message} {...register('subjectName')} />

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
            Create subject
          </Button>
        </div>
      </form>
    </Modal>
  );
}
