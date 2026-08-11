import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { Button } from '../../components/ui/Button';
import { useTransferOutStudent } from '../../hooks/useStudents';
import { transferOutFormSchema } from '../../lib/validation/student';
import type { TransferOutFormValues } from '../../lib/validation/student';
import type { StudentSummary } from '../../types/student';

interface Props {
  student: StudentSummary | null;
  onClose: () => void;
}

export function TransferOutModal({ student, onClose }: Props) {
  const transferOut = useTransferOutStudent();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransferOutFormValues>({
    resolver: zodResolver(transferOutFormSchema) as any,
  });

  async function onSubmit(values: TransferOutFormValues) {
    if (!student) return;
    setServerError(null);
    try {
      await transferOut.mutateAsync({
        studentId: student.studentId,
        input: {
          transferredOutDestination: values.transferredOutDestination || undefined,
          transferredOutReason: values.transferredOutReason || undefined,
        },
      });
      reset();
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not process the transfer out.');
    }
  }

  function handleClose() {
    reset();
    setServerError(null);
    onClose();
  }

  const studentName = student ? `${student.firstName} ${student.lastName}` : '';

  return (
    <Modal
      title="Student Transfer Out"
      isOpen={Boolean(student)}
      onClose={handleClose}
      widthClassName="max-w-[520px]"
    >
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
          You are recording that <strong>{studentName}</strong> is transferring out of this school.
          This action will mark the student as <em>Transferred Out</em> and cannot be easily undone.
        </p>

        <TextField
          label="Destination school (optional)"
          placeholder="Name of the school the student is transferring to"
          error={errors.transferredOutDestination?.message}
          {...register('transferredOutDestination')}
        />
        <TextAreaField
          label="Reason for transfer (optional)"
          rows={3}
          error={errors.transferredOutReason?.message}
          {...register('transferredOutReason')}
        />

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
            Confirm transfer out
          </Button>
        </div>
      </form>
    </Modal>
  );
}
