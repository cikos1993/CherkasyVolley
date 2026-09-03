import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — the database client cannot connect.");
}

const adapter = new PrismaPg({ connectionString });

const globalForDb = globalThis as unknown as { db?: PrismaClient };

// Reuse one client across Turbopack hot reloads so dev does not exhaust the pool.
export const db = globalForDb.db ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
