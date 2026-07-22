import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { useCreateStaff } from '../../hooks/useUsers';
import { createStaffFormSchema } from '../../lib/validation/user';
import type { CreateStaffFormValues } from '../../lib/validation/user';
import type { CreateStaffResult } from '../../types/user';

interface CreateStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: CreateStaffResult) => void;
}

export function CreateStaffModal({ isOpen, onClose, onCreated }: CreateStaffModalProps) {
  const createStaff = useCreateStaff();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStaffFormValues>({
    resolver: zodResolver(createStaffFormSchema),
    defaultValues: { role: 'TEACHER' },
  });

  const selectedRole = watch('role');

  async function onSubmit(values: CreateStaffFormValues) {
    setServerError(null);
    try {
      const result = await createStaff.mutateAsync({
        role: values.role,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email || undefined,
        phoneNumber: values.phoneNumber || undefined,
        qualification: values.qualification || undefined,
        specialization: values.specialization || undefined,
      });
      reset();
      onCreated(result);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not create the account.');
    }
  }

  function handleClose() {
    reset();
    setServerError(null);
    onClose();
  }

  return (
    <Modal title="Add staff account" isOpen={isOpen} onClose={handleClose}>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <SelectField label="Role" error={errors.role?.message} {...register('role')}>
          <option value="TEACHER">Teacher</option>
          <option value="VICE_DIRECTOR">Vice Director</option>
          <option value="DIRECTOR">Director</option>
          <option value="ADMIN">Administrator</option>
        </SelectField>

        <div className="grid grid-cols-2 gap-x-4">
          <TextField label="First name" error={errors.firstName?.message} {...register('firstName')} />
          <TextField label="Last name" error={errors.lastName?.message} {...register('lastName')} />
        </div>

        <TextField label="Email (optional)" type="email" error={errors.email?.message} {...register('email')} />

        {selectedRole === 'TEACHER' && (
          <>
            <TextField label="Phone number (optional)" error={errors.phoneNumber?.message} {...register('phoneNumber')} />
            <div className="grid grid-cols-2 gap-x-4">
              <TextField label="Qualification (optional)" error={errors.qualification?.message} {...register('qualification')} />
              <TextField label="Specialization (optional)" error={errors.specialization?.message} {...register('specialization')} />
            </div>
          </>
        )}

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
