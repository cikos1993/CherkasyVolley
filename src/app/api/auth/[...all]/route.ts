import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/auth/auth";

// pg / the Prisma adapter cannot run on the Edge runtime.
export const runtime = "nodejs";

export const { GET, POST } = toNextJsHandler(auth);
