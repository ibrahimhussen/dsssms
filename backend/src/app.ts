import express, { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { env } from './config/env';
import { logger } from './core/logger/logger';
import { apiRoutes } from './routes';
import { errorHandlerMiddleware } from './middlewares/error-handler.middleware';
import { generalRateLimiter } from './middlewares/rate-limiter.middleware';
import { ApiResponse } from './core/http/api-response';
import { NotFoundError } from './core/errors/app-error';

export function createApp(): Application {
  const app = express();

  // Trust the first proxy hop (needed for correct req.ip behind a load balancer / reverse proxy).
  app.set('trust proxy', 1);

  // --- Security & parsing middleware -----------------------------------------------------
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: true, limit: '4mb' }));
  app.use(cookieParser());

  // --- Request logging with correlation IDs -----------------------------------------------
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const existing = req.headers['x-request-id'];
        const id = (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    })
  );

  // --- Rate limiting (general) -------------------------------------------------------------
  app.use(generalRateLimiter);

  // --- Health check (unauthenticated, used by load balancers / uptime checks) --------------
  app.get('/health', (_req: Request, res: Response) => {
    ApiResponse.success(res, {
      message: 'Service is healthy',
      data: { status: 'ok', timestamp: new Date().toISOString() },
    });
  });

  // --- API routes ----------------------------------------------------------------------------
  app.use(env.API_PREFIX, apiRoutes);

  // --- 404 handler for anything not matched above --------------------------------------------
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
  });

  // --- Global error handler (must be registered last) ----------------------------------------
  app.use(errorHandlerMiddleware);

  return app;
}
