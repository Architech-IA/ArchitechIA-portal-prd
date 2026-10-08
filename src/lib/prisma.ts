import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Medido (2026-10-08): por el pooler en modo TRANSACCIÓN (puerto 6543, el DATABASE_URL de siempre)
// cada consulta de Prisma tarda ~500 ms; por el pooler en modo SESIÓN (5432) tarda ~100 ms
// (es la red Boston → Oregón). Si PRISMA_APP_URL está definida (URL de sesión con
// connection_limit bajo, ver .env), el portal la usa; el resto de procesos (workers, scripts)
// siguen con DATABASE_URL. Sin la variable, el comportamiento es el de antes.
const urlApp = process.env.PRISMA_APP_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(urlApp ? { datasources: { db: { url: urlApp } } } : undefined);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
