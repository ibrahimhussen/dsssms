import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env, isDevelopment } from '../config/env';
import { logger } from '../core/logger/logger';


const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaMariaDb(env.DATABASE_URL);

  return new PrismaClient({
    adapter,
    log: isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [{ emit: 'event', level: 'error' }],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

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
