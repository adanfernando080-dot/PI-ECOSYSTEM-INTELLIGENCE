import { PrismaClient } from '@prisma/client';

/**
 * Single PrismaClient per process. The API, workers and seed share it; the
 * frontend never talks to PostgreSQL directly.
 */
const globalForPrisma = globalThis as unknown as { __piPrisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__piPrisma) {
    globalForPrisma.__piPrisma = new PrismaClient({
      log: process.env.PRISMA_LOG === 'query' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
  }
  return globalForPrisma.__piPrisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.__piPrisma) {
    await globalForPrisma.__piPrisma.$disconnect();
    globalForPrisma.__piPrisma = undefined;
  }
}

export { Prisma, PrismaClient } from '@prisma/client';
export { loadDotEnv } from './load-env';
export type * from '@prisma/client';
