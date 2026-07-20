import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '../core/errors/app-error';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Validates and (via zod's parse) coerces `req[part]` against the given
 * schema. On failure, raises a ValidationError with field-level details so
 * the client can render inline form errors. On success, `req[part]` is
 * replaced with the parsed (and thus type-safe, defaulted, trimmed) value.
 */
export function validate(schema: AnyZodObject, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req[part] = schema.parse(req[part]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError('Validation failed', err.flatten().fieldErrors);
      }
      throw err;
    }
  };
}
