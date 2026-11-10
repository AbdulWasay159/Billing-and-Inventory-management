import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Makes a pooled connection string safe for serverless hosts (Vercel).
 * Supabase's transaction pooler (port 6543 / PgBouncer / Supavisor) does not
 * support prepared statements, so Prisma needs `pgbouncer=true`. On Vercel each
 * function instance should hold a single connection.
 */
export function resolveRuntimeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw || raw.trim().length === 0) return raw;
  try {
    const url = new URL(raw.trim());
    const isTransactionPooler = url.port === '6543';
    if (isTransactionPooler && !url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true');
    }
    if ((isTransactionPooler || process.env.VERCEL) && !url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '1');
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function createPrismaClient(): PrismaClient {
  const url = resolveRuntimeDatabaseUrl(process.env.DATABASE_URL);
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    ...(url ? { datasources: { db: { url } } } : {}),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Interactive transaction limits. Prisma's defaults (maxWait 2s, timeout 5s) are
 * too tight for a serverless function talking to a remote pooled database: a bill
 * with several lines exceeded 5s and Prisma closed the transaction mid-way
 * ("Transaction not found"). Give it headroom.
 */
export const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

export default prisma;
