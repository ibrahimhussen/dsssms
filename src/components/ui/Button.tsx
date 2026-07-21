import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  isLoading?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', isLoading = false, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={clsx('btn', `btn-${variant}`, isLoading && 'btn-loading', className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...rest}
    >
      {isLoading && <span className="spinner spinner-sm" aria-hidden="true" />}
      <span className="btn-label">{children}</span>
    </button>
  );
}
