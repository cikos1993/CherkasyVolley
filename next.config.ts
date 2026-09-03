import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` does dynamic requires (optional pg-native, pg-cloudflare) that the
  // bundler cannot statically resolve — keep it and the adapter external.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};

export default nextConfig;
