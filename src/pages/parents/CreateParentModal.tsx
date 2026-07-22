import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { useCreateParent } from '../../hooks/useParents';
import { createParentFormSchema } from '../../lib/validation/parent';
import type { CreateParentFormValues } from '../../lib/validation/parent';
import type { CreateParentResult } from '../../types/parent';

interface CreateParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: CreateParentResult) => void;
}

export function CreateParentModal({ isOpen, onClose, onCreated }: CreateParentModalProps) {
  const createParent = useCreateParent();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateParentFormValues>({ resolver: zodResolver(createParentFormSchema) });

  async function onSubmit(values: CreateParentFormValues) {
    setServerError(null);
    try {
      const result = await createParent.mutateAsync({
        fullName: values.fullName,
        phoneNumber: values.phoneNumber || undefined,
        email: values.email || undefined,
      });
      reset();
      onCreated(result);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not create the parent account.');
    }
  }

  function handleClose() {
    reset();
    setServerError(null);
    onClose();
  }

  return (
    <Modal title="Add parent/guardian" isOpen={isOpen} onClose={handleClose}>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <TextField label="Full name" error={errors.fullName?.message} {...register('fullName')} />
        <TextField label="Phone number (optional)" error={errors.phoneNumber?.message} {...register('phoneNumber')} />
        <TextField label="Email (optional)" type="email" error={errors.email?.message} {...register('email')} />

        <p className="mb-4 text-sm text-slate-500">
          After creating this account, link it to a student from the student's registration or details screen.
        </p>

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
            Create account
          </Button>
        </div>
      </form>
    </Modal>
  );
}
