import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  pgPool?: Pool;
  pgPoolConnectionString?: string;
  prisma?: PrismaClient;
  prismaConnectionString?: string;
};

function getDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. Set it in .env locally and in Vercel environment variables.");
  }

  return connectionString;
}

function getSafeDatabaseHost(connectionString: string) {
  try {
    return new URL(connectionString).host;
  } catch {
    return "invalid-database-url";
  }
}

function createPrismaClient() {
  const connectionString = getDatabaseUrl();
  const pool =
    globalForPrisma.pgPool && globalForPrisma.pgPoolConnectionString === connectionString
      ? globalForPrisma.pgPool
      : new Pool({
          connectionString,
          connectionTimeoutMillis: Number.parseInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS || "15000", 10),
          idleTimeoutMillis: Number.parseInt(process.env.DATABASE_IDLE_TIMEOUT_MS || "10000", 10),
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
          max: Number.parseInt(process.env.DATABASE_POOL_MAX || "3", 10)
        });

  globalForPrisma.pgPool = pool;
  globalForPrisma.pgPoolConnectionString = connectionString;

  const adapter = new PrismaPg(pool, {
    onConnectionError(error) {
      console.warn("PostgreSQL connection error", error.message);
    },
    onPoolError(error) {
      console.warn("PostgreSQL pool error", error.message);
    }
  });

  console.info(`Prisma database host: ${getSafeDatabaseHost(connectionString)}`);

  return new PrismaClient({ adapter });
}

const connectionString = getDatabaseUrl();

export const prisma =
  globalForPrisma.prisma && globalForPrisma.prismaConnectionString === connectionString
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaConnectionString = connectionString;
}
