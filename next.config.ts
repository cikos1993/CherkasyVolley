import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Postgres driver out of the server bundle — it resolves its own
  // optional native dependency (pg-native) at runtime.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};

export default nextConfig;
