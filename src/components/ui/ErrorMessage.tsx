import { MdErrorOutline, MdWarningAmber } from 'react-icons/md';
import { ApiError } from '../../lib/api-error';
import clsx from 'clsx';

interface ErrorMessageProps {
  /** Any thrown value — ApiError, Error, or unknown */
  error: unknown;
  className?: string;
}

/**
 * Renders a compact inline error banner for mutation failures inside forms
 * and action handlers. Shows field-level details when available.
 */
export function ErrorMessage({ error, className }: ErrorMessageProps) {
  if (!error) return null;

  const isValidation = error instanceof ApiError && error.isValidation;
  const message = formatError(error);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={clsx(
        'flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm',
        isValidation
          ? 'bg-gold-50 text-gold-700 border border-gold-200'
          : 'bg-danger-50 text-danger-700 border border-danger-200',
        className
      )}
    >
      {isValidation ? (
        <MdWarningAmber className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <MdErrorOutline className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="font-medium">{isValidation ? 'Please fix the following:' : message}</p>
        {isValidation && error instanceof ApiError && error.details && (
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {Object.entries(error.details).map(([field, msgs]) =>
              msgs.map((msg, i) => (
                <li key={`${field}-${i}`}>
                  <span className="font-medium capitalize">{field.replace(/_/g, ' ')}</span>: {msg}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.isValidation ? error.fieldErrorSummary() : error.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred. Please try again.';
}

interface QueryErrorProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

/**
 * Used inside page bodies when a data-fetch query fails.
 * Shows the error and an optional retry button.
 */
export function QueryError({ error, onRetry, className }: QueryErrorProps) {
  if (!error) return null;

  const message = formatError(error);
  const isForbidden = error instanceof ApiError && error.isForbidden;

  return (
    <div
      role="alert"
      className={clsx(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border py-10 text-center',
        isForbidden
          ? 'border-gold-200 bg-gold-50'
          : 'border-danger-200 bg-danger-50',
        className
      )}
    >
      <MdErrorOutline
        className={clsx('h-8 w-8', isForbidden ? 'text-gold-500' : 'text-danger-500')}
      />
      <div>
        <p className={clsx('font-semibold', isForbidden ? 'text-gold-700' : 'text-danger-700')}>
          {isForbidden ? 'Access denied' : 'Failed to load data'}
        </p>
        <p className={clsx('mt-0.5 text-sm', isForbidden ? 'text-gold-600' : 'text-danger-600')}>
          {message}
        </p>
      </div>
      {onRetry && !isForbidden && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-danger-300 bg-white px-4 py-1.5 text-sm font-semibold text-danger-700 hover:bg-danger-50"
        >
          Try again
        </button>
      )}
    </div>
  );
}
