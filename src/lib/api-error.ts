/**
 * Typed error thrown by unwrap() and unwrapPaginated() whenever the server
 * returns { success: false }. Carries the errorCode and field-level details
 * so callers can display specific validation messages instead of only the
 * generic summary string.
 */
export class ApiError extends Error {
  public readonly errorCode: string;
  public readonly statusCode: number;
  /** Field-level validation errors — present when errorCode === 'VALIDATION_ERROR' */
  public readonly details?: Record<string, string[]>;

  constructor(params: {
    message: string;
    errorCode: string;
    statusCode: number;
    details?: unknown;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.errorCode = params.errorCode;
    this.statusCode = params.statusCode;
    this.details = normaliseDetails(params.details);
  }

  /** Returns field errors as a flat string, useful for generic error displays. */
  fieldErrorSummary(): string {
    if (!this.details) return this.message;
    const entries = Object.entries(this.details);
    if (entries.length === 0) return this.message;
    return entries.map(([field, msgs]) => `${field}: ${msgs.join(', ')}`).join(' — ');
  }

  /** True when this is a 401 — used by the auth interceptor. */
  get isUnauthorized() {
    return this.statusCode === 401;
  }

  /** True when this is a 403. */
  get isForbidden() {
    return this.statusCode === 403;
  }

  /** True when this is a 422 validation failure with field details. */
  get isValidation() {
    return this.errorCode === 'VALIDATION_ERROR';
  }
}

/**
 * Normalises whatever the server puts in `details` into a simple
 * Record<field, string[]> so callers always get the same shape.
 */
function normaliseDetails(raw: unknown): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  // Zod flatten() produces { fieldErrors: { field: string[] }, formErrors: string[] }
  if ('fieldErrors' in raw && typeof (raw as any).fieldErrors === 'object') {
    const fe = (raw as any).fieldErrors as Record<string, unknown>;
    const out: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(fe)) {
      if (Array.isArray(val)) out[key] = val.map(String);
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  // Plain object with string[] values — already the right shape
  const out: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(val)) out[key] = val.map(String);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Extracts a user-readable message from any thrown value. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.isValidation ? err.fieldErrorSummary() : err.message;
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred. Please try again.';
}

/** Returns field errors for a specific field, or an empty array. */
export function getFieldErrors(err: unknown, field: string): string[] {
  if (err instanceof ApiError && err.details) {
    return err.details[field] ?? [];
  }
  return [];
}
