import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | undefined;

/** One Prisma client per process. */
export function getPrisma(): PrismaClient {
  prisma ??= new PrismaClient({ log: ['warn', 'error'] });
  return prisma;
}

export * from '@prisma/client';
