import { PrismaClient } from '@prisma/client';
import { isDevelopment } from '../config/env';
import { logger } from '../core/logger/logger';

/**
 * A single, shared Prisma client instance for the whole process.
 *
 * We stash it on `globalThis` in development so that `tsx watch` hot
 * reloads don't spawn a fresh client (and a fresh connection pool) on
 * every file save.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [{ emit: 'event', level: 'error' }],
  });

if (isDevelopment) {
  globalForPrisma.prisma = prisma;

  // @ts-expect-error - prisma event typings are narrower than the runtime event set
  prisma.$on('query', (e: { query: string; duration: number }) => {
    logger.debug({ query: e.query, durationMs: e.duration }, 'prisma:query');
  });
}

// @ts-expect-error - see above
prisma.$on('error', (e: { message: string }) => {
  logger.error({ err: e.message }, 'prisma:error');
});

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connection established');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database connection closed');
}
