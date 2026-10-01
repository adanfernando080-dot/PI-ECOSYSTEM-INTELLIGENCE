import { disconnectPrisma, getPrisma, loadDotEnv } from '@pi/database';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { configureServerTimeouts } from './http/server-timeouts';
import { createLogger } from './lib/logger';
import { createPrismaRepositories } from './repositories/prisma';

loadDotEnv();
const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
const prisma = getPrisma();

const { app, close } = createApp({
  env,
  logger,
  repos: createPrismaRepositories(prisma),
  healthCheck: async () => {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  },
});

const server = configureServerTimeouts(
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Pi Ecosystem Intelligence API listening');
  }),
);

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down');
  server.close();
  await close();
  await disconnectPrisma();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
