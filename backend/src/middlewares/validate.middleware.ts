import { NextFunction, Request, Response } from 'express';
import { ZodType, ZodError } from 'zod';
import { ValidationError } from '../core/errors/app-error';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodType, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[part]);

      if (part === 'query') {
        Object.defineProperty(req, 'query', {
          value: parsed,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        req[part] = parsed;
      }

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError('Validation failed', err.flatten().fieldErrors);
      }
      throw err;
    }
  };
}