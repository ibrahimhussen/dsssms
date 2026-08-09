import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSystemSettings, useUpdateSystemSettings } from '../../hooks/useSystemSettings';
import { systemSettingFormSchema } from '../../lib/validation/system-setting';
import type { SystemSettingFormValues } from '../../lib/validation/system-setting';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';

export function SystemSettingsPage() {
  const { data, isLoading } = useSystemSettings();
  const updateSettings = useUpdateSystemSettings();
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SystemSettingFormValues>({
    resolver: zodResolver(systemSettingFormSchema),
    values: data
      ? {
          schoolName: data.schoolName,
          schoolAddress: data.schoolAddress ?? '',
          contactEmail: data.contactEmail ?? '',
          contactPhone: data.contactPhone ?? '',
          currentAcademicYear: data.currentAcademicYear,
        }
      : undefined,
  });

  async function onSubmit(values: SystemSettingFormValues) {
    setServerError(null);
    setSavedAt(null);
    try {
      await updateSettings.mutateAsync({
        schoolName: values.schoolName,
        schoolAddress: values.schoolAddress || undefined,
        contactEmail: values.contactEmail || undefined,
        contactPhone: values.contactPhone || undefined,
        currentAcademicYear: values.currentAcademicYear,
      });
      setSavedAt(new Date());
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not save the settings.');
    }
  }

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">System settings</h1>
      <p className="mb-1 text-[0.9375rem] text-ink-700">School-wide configuration shown across the app.</p>
      <LedgerRule />

      <Card className="max-w-[560px]">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
            <TextField label="School name" error={errors.schoolName?.message} {...register('schoolName')} />
            <TextField label="School address (optional)" error={errors.schoolAddress?.message} {...register('schoolAddress')} />
            <div className="grid grid-cols-2 gap-x-4">
              <TextField
                label="Contact email (optional)"
                type="email"
                error={errors.contactEmail?.message}
                {...register('contactEmail')}
              />
              <TextField label="Contact phone (optional)" error={errors.contactPhone?.message} {...register('contactPhone')} />
            </div>
            <TextField
              label="Current academic year"
              placeholder="e.g. 2026/27"
              error={errors.currentAcademicYear?.message}
              {...register('currentAcademicYear')}
            />

            {data?.updatedByUsername && (
              <p className="mb-4 text-[0.8125rem] text-slate-500">
                Last updated by {data.updatedByUsername} on {new Date(data.updatedAt).toLocaleString()}
              </p>
            )}

            {serverError && (
              <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
                {serverError}
              </p>
            )}
            {savedAt && (
              <p className="mb-4 rounded-lg bg-pine-100 px-3 py-2.5 text-sm text-pine-800" role="status">
                Saved.
              </p>
            )}

            <div className="mt-2 flex justify-end">
              <Button type="submit" isLoading={isSubmitting}>
                Save changes
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
