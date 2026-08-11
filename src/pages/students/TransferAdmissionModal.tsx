import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { Button } from '../../components/ui/Button';
import { useCreateStudent } from '../../hooks/useStudents';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { transferAdmissionFormSchema } from '../../lib/validation/student';
import type { TransferAdmissionFormValues } from '../../lib/validation/student';
import type { CreateStudentResult } from '../../types/student';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: CreateStudentResult) => void;
}

export function TransferAdmissionModal({ isOpen, onClose, onCreated }: Props) {
  const createStudent = useCreateStudent();
  const { data: classroomsData } = useClassroomOptions();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransferAdmissionFormValues>({
    resolver: zodResolver(transferAdmissionFormSchema) as any,
    defaultValues: { addGuardian: false },
  });

  const addGuardian = watch('addGuardian');

  async function onSubmit(values: TransferAdmissionFormValues) {
    setServerError(null);
    try {
      const result = await createStudent.mutateAsync({
        admissionType: 'TRANSFER',
        firstName: values.firstName,
        lastName: values.lastName,
        gender: values.gender,
        dateOfBirth: values.dateOfBirth,
        address: values.address || undefined,
        classroomId: values.classroomId,
        previousSchoolName: values.previousSchoolName,
        previousSchoolType: values.previousSchoolType || undefined,
        previousSchoolLocation: values.previousSchoolLocation || undefined,
        lastGradeCompleted: values.lastGradeCompleted,
        completionYear: values.completionYear || undefined,
        previousStudentId: values.previousStudentId || undefined,
        transferReason: values.transferReason || undefined,
        transferCertificateRef: values.transferCertificateRef || undefined,
        parents: values.addGuardian
          ? [
              {
                newParent: {
                  fullName: values.guardianFullName!,
                  phoneNumber: values.guardianPhoneNumber || undefined,
                },
                relationship: values.guardianRelationship!,
              },
            ]
          : undefined,
      });
      reset();
      onCreated(result);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not register the transfer student.');
    }
  }

  function handleClose() {
    reset();
    setServerError(null);
    onClose();
  }

  return (
    <Modal title="Transfer Student Admission" isOpen={isOpen} onClose={handleClose} widthClassName="max-w-[720px]">
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>

        {/* ── Note ────────────────────────────────────────────────────── */}
        <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-700">
          Use this form for students transferring <strong>into</strong> this school from another school.
          Previous school records are required and will be subject to verification.
        </p>

        {/* ── Student Information ──────────────────────────────────────── */}
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Student Information
        </p>
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
        <SelectField label="Admission Classroom" error={errors.classroomId?.message} {...register('classroomId')}>
          <option value="">Select a classroom…</option>
          {classroomsData?.items.map((c) => (
            <option key={c.classroomId} value={c.classroomId}>
              {c.className} {c.section} ({c.academicYear})
            </option>
          ))}
        </SelectField>

        {/* ── Previous School (required for transfers) ──────────────── */}
        <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Previous School <span className="font-normal normal-case text-slate-400">(required)</span>
        </p>
        <div className="rounded-lg border border-slate-200 bg-paper-50 p-4">
          <div className="grid grid-cols-2 gap-x-4">
            <TextField
              label="Previous school name *"
              error={errors.previousSchoolName?.message}
              {...register('previousSchoolName')}
            />
            <SelectField label="School type" error={errors.previousSchoolType?.message} {...register('previousSchoolType')}>
              <option value="">Select…</option>
              <option value="Secondary">Secondary / High School</option>
              <option value="Primary">Primary / Elementary</option>
              <option value="Other">Other</option>
            </SelectField>
          </div>
          <div className="grid grid-cols-2 gap-x-4">
            <TextField label="School location" error={errors.previousSchoolLocation?.message} {...register('previousSchoolLocation')} />
            <TextField
              label="Last grade completed *"
              placeholder="e.g. Grade 10"
              error={errors.lastGradeCompleted?.message}
              {...register('lastGradeCompleted')}
            />
          </div>
          <div className="grid grid-cols-2 gap-x-4">
            <TextField label="Completion year" placeholder="e.g. 2024" error={errors.completionYear?.message} {...register('completionYear')} />
            <TextField label="Previous student ID" placeholder="(if available)" error={errors.previousStudentId?.message} {...register('previousStudentId')} />
          </div>
        </div>

        {/* ── Transfer Information ──────────────────────────────────── */}
        <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Transfer Information
        </p>
        <div className="rounded-lg border border-slate-200 bg-paper-50 p-4">
          <TextField
            label="Transfer certificate / reference number"
            placeholder="e.g. TC-2024-0123"
            error={errors.transferCertificateRef?.message}
            {...register('transferCertificateRef')}
          />
          <TextAreaField
            label="Reason for transfer (optional)"
            rows={2}
            error={errors.transferReason?.message}
            {...register('transferReason')}
          />
        </div>

        {/* ── Guardian ─────────────────────────────────────────────────── */}
        <label className="mb-4 mt-5 flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" {...register('addGuardian')} />
          Add a guardian for this student
        </label>

        {addGuardian && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-paper-50 p-4">
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
            Admit transfer student
          </Button>
        </div>
      </form>
    </Modal>
  );
}
