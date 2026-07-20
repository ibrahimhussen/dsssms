/**
 * Base class for every predictable, "expected" error in the application
 * (validation failures, auth failures, not-found, conflicts, etc).
 *
 * Anything that is NOT an AppError bubbling out of a controller is treated
 * by the global error handler as an unexpected bug and logged at a higher
 * severity, with its details hidden from the client in production.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode: string;
  public readonly details?: unknown;

  constructor(params: {
    message: string;
    statusCode: number;
    errorCode: string;
    isOperational?: boolean;
    details?: unknown;
  }) {
    super(params.message);
    this.name = this.constructor.name;
    this.statusCode = params.statusCode;
    this.errorCode = params.errorCode;
    this.isOperational = params.isOperational ?? true;
    this.details = params.details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super({ message, statusCode: 400, errorCode: 'BAD_REQUEST', details });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super({ message, statusCode: 422, errorCode: 'VALIDATION_ERROR', details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super({ message, statusCode: 401, errorCode: 'UNAUTHORIZED' });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super({ message, statusCode: 403, errorCode: 'FORBIDDEN' });
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super({ message: `${resource} not found`, statusCode: 404, errorCode: 'NOT_FOUND' });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super({ message, statusCode: 409, errorCode: 'CONFLICT' });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super({ message, statusCode: 429, errorCode: 'TOO_MANY_REQUESTS' });
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'An unexpected error occurred') {
    super({ message, statusCode: 500, errorCode: 'INTERNAL_SERVER_ERROR', isOperational: false });
  }
}
