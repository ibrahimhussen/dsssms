import { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async Express route/controller so that any rejected promise
 * (thrown error) is automatically forwarded to `next()`, landing in the
 * global error handler instead of crashing the process or hanging the
 * request. Keeps controllers free of repetitive try/catch blocks.
 */
export function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
