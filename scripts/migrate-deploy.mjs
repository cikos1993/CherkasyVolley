import { execSync } from "node:child_process";

// Vercel sets VERCEL_ENV to production | preview | development. Preview/branch
// builds must not apply migrations to the single shared database — only the
// production build (and local builds, where VERCEL_ENV is unset) run them.
const vercelEnv = process.env.VERCEL_ENV;

if (vercelEnv && vercelEnv !== "production") {
  console.log(`migrate-deploy: skipped on VERCEL_ENV=${vercelEnv}`);
  process.exit(0);
}

execSync("prisma migrate deploy", { stdio: "inherit" });
