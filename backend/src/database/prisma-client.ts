import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env, isDevelopment } from '../config/env';
import { logger } from '../core/logger/logger';


const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const dbUrl = new URL(env.DATABASE_URL);

  const adapter = new PrismaMariaDb({
    host: dbUrl.hostname,
    port: dbUrl.port ? Number(dbUrl.port) : 3306,
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.replace(/^\//, ''),
    connectionLimit: 10,
    // Required for MySQL's caching_sha2_password auth plugin (default on
    // MySQL 8.4+/9.x) to complete its RSA handshake over an unencrypted
    // TCP connection. Without this, the driver hangs during auth instead
    // of erroring, which surfaces as a pool timeout with active=0 idle=0.
    allowPublicKeyRetrieval: true,
  });

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