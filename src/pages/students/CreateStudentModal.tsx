import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Button } from '../../components/ui/Button';
import { useCreateStudent } from '../../hooks/useStudents';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { createStudentFormSchema } from '../../lib/validation/student';
import type { CreateStudentFormValues } from '../../lib/validation/student';
import type { CreateStudentResult } from '../../types/student';

interface CreateStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: CreateStudentResult) => void;
}

export function CreateStudentModal({ isOpen, onClose, onCreated }: CreateStudentModalProps) {
  const createStudent = useCreateStudent();
  const { data: classroomsData } = useClassroomOptions();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStudentFormValues>({
    resolver: zodResolver(createStudentFormSchema) as any,
    defaultValues: { addGuardian: false },
  });

  const addGuardian = watch('addGuardian');

  async function onSubmit(values: CreateStudentFormValues) {
    setServerError(null);
    try {
      const result = await createStudent.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        gender: values.gender,
        dateOfBirth: values.dateOfBirth,
        address: values.address || undefined,
        classroomId: values.classroomId,
        parents: values.addGuardian
          ? [
              {
                newParent: { fullName: values.guardianFullName!, phoneNumber: values.guardianPhoneNumber || undefined },
                relationship: values.guardianRelationship!,
              },
            ]
          : undefined,
      });
      reset();
      onCreated(result);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not register the student.');
    }
  }

  function handleClose() {
    reset();
    setServerError(null);
    onClose();
  }

  return (
    <Modal title="Register student" isOpen={isOpen} onClose={handleClose} widthClassName="max-w-[640px]">
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <div className="grid grid-cols-2 gap-x-4">
          <TextField label="First name" error={errors.firstName?.message} {...register('firstName')} />
          <TextField label="Last name" error={errors.lastName?.message} {...register('lastName')} />
        </div>

        <div className="grid grid-cols-2 gap-x-4">
          <SelectField label="Gender" error={errors.gender?.message} {...register('gender')}>
            <option value="">Select…</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </SelectField>
          <TextField label="Date of birth" type="date" error={errors.dateOfBirth?.message} {...register('dateOfBirth')} />
        </div>

        <TextField label="Address (optional)" error={errors.address?.message} {...register('address')} />

        <SelectField label="Classroom" error={errors.classroomId?.message} {...register('classroomId')}>
          <option value="">Select a classroom…</option>
          {classroomsData?.items.map((c) => (
            <option key={c.classroomId} value={c.classroomId}>
              {c.className} {c.section} ({c.academicYear})
            </option>
          ))}
        </SelectField>

        <label className="mb-4 mt-1 flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" {...register('addGuardian')} />
          Add a guardian for this student
        </label>

        {addGuardian && (
          <div className="mb-4.5 rounded-lg border border-slate-200 bg-paper-50 p-4">
            <TextField label="Guardian full name" error={errors.guardianFullName?.message} {...register('guardianFullName')} />
            <div className="grid grid-cols-2 gap-x-4">
              <TextField
                label="Guardian phone (optional)"
                error={errors.guardianPhoneNumber?.message}
                {...register('guardianPhoneNumber')}
              />
              <SelectField label="Relationship" error={errors.guardianRelationship?.message} {...register('guardianRelationship')}>
                <option value="">Select…</option>
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="GUARDIAN">Guardian</option>
                <option value="OTHER">Other</option>
              </SelectField>
            </div>
          </div>
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
            Register student
          </Button>
        </div>
      </form>
    </Modal>
  );
}
