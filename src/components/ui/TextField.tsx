import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, id, className, ...rest },
  ref
) {
  const fieldId = id ?? rest.name;

  return (
    <div className="field">
      <label htmlFor={fieldId} className="field-label">
        {label}
      </label>
      <input
        id={fieldId}
        ref={ref}
        className={clsx('field-input', error && 'field-input-error', className)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...rest}
      />
      {error && (
        <p className="field-error" id={`${fieldId}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
