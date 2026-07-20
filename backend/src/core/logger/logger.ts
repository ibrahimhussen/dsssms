import pino from 'pino';
import { env, isDevelopment } from '../../config/env';

/**
 * Central application logger. In development it prints human-readable,
 * colorized output; in production it emits structured JSON suitable for
 * log aggregation systems (ELK, CloudWatch, Datadog, etc).
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: { service: 'dsssms-backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
