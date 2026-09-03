import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js loads .env.local; Prisma's CLI does not, so load it here (then .env as a fallback).
config({ path: [".env.local", ".env"] });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Runs after `migrate dev` / `migrate reset` and on `prisma db seed`.
    // tsx resolves the extensionless imports in the generated Prisma client;
    // .mts keeps the script ESM (top-level await).
    seed: "tsx prisma/seed.mts",
  },
  datasource: {
    // Migrations need a direct (non-pooled) connection. Neon's Vercel integration
    // exposes it as DATABASE_URL_UNPOOLED; a hand-set DIRECT_URL takes precedence.
    url:
      process.env["DIRECT_URL"] ??
      process.env["DATABASE_URL_UNPOOLED"] ??
      process.env["DATABASE_URL"],
  },
});
