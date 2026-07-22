import { forwardRef } from 'react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  children: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, id, className, children, ...rest },
  ref
) {
  const fieldId = id ?? rest.name;

  return (
    <div className="mb-4.5 flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-[0.8125rem] font-semibold text-ink-700">
        {label}
      </label>
      <select
        id={fieldId}
        ref={ref}
        className={clsx(
          'rounded-lg border bg-white px-3 py-2.5 font-body text-[0.9375rem] text-ink-900',
          error ? 'border-danger-600' : 'border-slate-200',
          className
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p className="m-0 text-[0.8125rem] text-danger-600" id={`${fieldId}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
