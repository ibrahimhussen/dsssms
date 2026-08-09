import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  isLoading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-pine-900 text-paper-50 border-transparent hover:bg-pine-700',
  secondary: 'bg-transparent text-pine-900 border-pine-900 hover:bg-pine-100',
  ghost: 'bg-transparent text-ink-700 border-slate-200 hover:bg-paper-100',
  outline: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50',
  danger: 'bg-danger-600 text-paper-50 border-transparent hover:opacity-90',
};

export function Button({ variant = 'primary', isLoading = false, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg border px-4.5 py-2.5 text-[0.9375rem] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-65',
        VARIANT_CLASSES[variant],
        className
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...rest}
    >
      {isLoading && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current"
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </button>
  );
}
