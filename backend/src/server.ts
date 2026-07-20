import { createApp } from './app';
import { env } from './config/env';
import { logger } from './core/logger/logger';
import { connectDatabase, disconnectDatabase } from './database/prisma-client';

async function main(): Promise<void> {
  await connectDatabase();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`DSSSMS backend listening on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`API base path: ${env.API_PREFIX}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    server.close(async (err) => {
      if (err) {
        logger.error({ err }, 'Error while closing HTTP server');
        process.exitCode = 1;
      }

      await disconnectDatabase();
      logger.info('Graceful shutdown complete.');
      process.exit(process.exitCode ?? 0);
    });

    // Failsafe: if connections don't drain in time, force exit.
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception — shutting down');
    process.exit(1);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
