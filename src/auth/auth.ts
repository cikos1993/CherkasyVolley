import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/data/client";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      prompt: "select_account",
    },
  },
  account: {
    // Link a first Google sign-in to the user seeded by email (whose own
    // emailVerified is still false).
    accountLinking: { enabled: true, trustedProviders: ["google"] },
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
