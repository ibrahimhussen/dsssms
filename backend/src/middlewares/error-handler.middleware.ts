import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../core/errors/app-error';
import { ApiResponse } from '../core/http/api-response';
import { logger } from '../core/logger/logger';
import { isProduction } from '../config/env';

/**
 * Translates a Prisma error into a known AppError shape so the client gets
 * a meaningful, safe message instead of a raw database error.
 */
function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  message: string;
  errorCode: string;
} {
  switch (err.code) {
    case 'P2002':
      return {
        statusCode: 409,
        message: `A record with this ${(err.meta?.target as string[] | undefined)?.join(', ') ?? 'value'} already exists`,
        errorCode: 'CONFLICT',
      };
    case 'P2025':
      return { statusCode: 404, message: 'The requested record was not found', errorCode: 'NOT_FOUND' };
    case 'P2003':
      return {
        statusCode: 409,
        message: 'This action violates a data relationship constraint',
        errorCode: 'FOREIGN_KEY_CONSTRAINT',
      };
    default:
      return { statusCode: 500, message: 'A database error occurred', errorCode: 'DATABASE_ERROR' };
  }
}

/**
 * Express requires exactly four parameters for an error-handling middleware
 * to be recognized as such — do not remove the unused `next`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandlerMiddleware(err: unknown, req: Request, res: Response, next: NextFunction): void {
  // 1. Known, operational application errors
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err, path: req.path }, 'Non-operational application error');
    } else {
      logger.warn({ errorCode: err.errorCode, message: err.message, path: req.path }, 'Handled application error');
    }

    ApiResponse.error(res, {
      statusCode: err.statusCode,
      message: err.message,
      errorCode: err.errorCode,
      details: err.details,
    });
    return;
  }

  // 2. Zod validation errors that slipped through without our validate() middleware
  if (err instanceof ZodError) {
    ApiResponse.error(res, {
      statusCode: 422,
      message: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      details: err.flatten(),
    });
    return;
  }

  // 3. Known Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(err);
    logger.warn({ prismaCode: err.code, path: req.path }, 'Prisma known request error');
    ApiResponse.error(res, mapped);
    return;
  }

  // 4. Anything else is unexpected — log full detail server-side, hide it from the client
  logger.error({ err, path: req.path }, 'Unhandled error');

  ApiResponse.error(res, {
    statusCode: 500,
    message: isProduction ? 'An unexpected error occurred' : (err as Error)?.message ?? 'Unknown error',
    errorCode: 'INTERNAL_SERVER_ERROR',
  });
}
