import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/data/client";

const {
  BETTER_AUTH_URL,
  BETTER_AUTH_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  VERCEL_ENV,
} = process.env;

// `next build` evaluates this module before the (runtime-only) Vercel env is
// available, so only fail-fast on a real production cold start.
if (VERCEL_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  const missing = Object.entries({
    BETTER_AUTH_URL,
    BETTER_AUTH_SECRET,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(`Auth env vars missing in production: ${missing.join(", ")}`);
  }
}

export const auth = betterAuth({
  baseURL: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: GOOGLE_CLIENT_ID as string,
      clientSecret: GOOGLE_CLIENT_SECRET as string,
      prompt: "select_account",
    },
  },
  account: {
    // Link a first Google sign-in to the user seeded by email, and pull
    // name/image from Google onto it. The seeded admin's own email is not
    // "verified" (no prior login), so requireLocalEmailVerified must be off —
    // the seed itself is the trust decision.
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      requireLocalEmailVerified: false,
      updateUserInfoOnLink: true,
    },
  },
  user: {
    additionalFields: {
      // Set only by the admin-management Server Action, never through the auth API.
      isAdmin: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  advanced: {
    // Ids come from the Prisma `@default(cuid())` on every model.
    database: { generateId: false },
  },
  plugins: [nextCookies()],
});
