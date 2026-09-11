import { useRef, useState } from 'react';
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
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

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
          schoolZone: data.schoolZone ?? '',
          schoolWereda: data.schoolWereda ?? '',
          schoolRegion: data.schoolRegion ?? '',
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
        schoolZone: values.schoolZone || undefined,
        schoolWereda: values.schoolWereda || undefined,
        schoolRegion: values.schoolRegion || undefined,
        contactEmail: values.contactEmail || undefined,
        contactPhone: values.contactPhone || undefined,
        currentAcademicYear: values.currentAcademicYear,
        schoolLogo: logoPreview ?? data?.schoolLogo ?? undefined,
      });
      setSavedAt(new Date());
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not save the settings.');
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setLogoError('Only JPG, PNG, WebP, or SVG logos are supported.'); return;
    }
    if (file.size > 2_000_000) {
      setLogoError('Logo must be smaller than 2 MB.'); return;
    }
    setLogoError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    setLogoPreview('');   // empty string = explicit removal
    if (logoRef.current) logoRef.current.value = '';
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
              <TextField label="Zone (optional)" placeholder="e.g. Bale" error={errors.schoolZone?.message} {...register('schoolZone')} />
              <TextField label="Wereda (optional)" placeholder="e.g. Dinsho" error={errors.schoolWereda?.message} {...register('schoolWereda')} />
            </div>
            <TextField label="Region (optional)" placeholder="e.g. Oromia" error={errors.schoolRegion?.message} {...register('schoolRegion')} />
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

            {/* ── School logo ── */}
            <div className="mb-4">
              <label className="mb-1.5 block text-[0.8125rem] font-semibold text-ink-700">
                School Logo (optional)
              </label>
              <p className="mb-2 text-[0.75rem] text-slate-500">
                Appears on printed transcripts. JPG, PNG, WebP, or SVG — max 2 MB.
              </p>

              {/* Current / preview */}
              {(logoPreview !== '' && (logoPreview || data?.schoolLogo)) && (
                <div className="mb-2 flex items-center gap-3">
                  <img
                    src={logoPreview ?? data?.schoolLogo ?? ''}
                    alt="School logo"
                    className="h-16 max-w-[120px] rounded border border-slate-200 object-contain p-1"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-xs text-danger-600 hover:underline"
                  >
                    Remove logo
                  </button>
                </div>
              )}

              <input
                ref={logoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                onChange={handleLogoChange}
                className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-pine-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-pine-800 hover:file:bg-pine-100"
              />
              {logoError && (
                <p className="mt-1 text-xs text-danger-600">{logoError}</p>
              )}
            </div>

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
