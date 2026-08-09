import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, error, id, className, rows = 4, ...rest },
  ref
) {
  const fieldId = id ?? rest.name;

  return (
    <div className="mb-4.5 flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-[0.8125rem] font-semibold text-ink-700">
        {label}
      </label>
      <textarea
        id={fieldId}
        ref={ref}
        rows={rows}
        className={clsx(
          'rounded-lg border bg-white px-3 py-2.5 font-body text-[0.9375rem] text-ink-900',
          error ? 'border-danger-600' : 'border-slate-200',
          className
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...rest}
      />
      {error && (
        <p className="m-0 text-[0.8125rem] text-danger-600" id={`${fieldId}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
