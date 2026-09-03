import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const globalForDb = globalThis as unknown as { db?: PrismaClient };

// Reuse one client across Turbopack hot reloads so dev does not exhaust the pool.
export const db = globalForDb.db ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
