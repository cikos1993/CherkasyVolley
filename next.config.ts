import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` does dynamic requires (optional pg-native, pg-cloudflare) that the
  // bundler cannot statically resolve — keep it and the adapter external.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  async redirects() {
    return [{ source: "/", destination: "/classic", permanent: true }];
  },
};

export default nextConfig;
