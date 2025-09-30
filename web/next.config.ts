import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    externalDir: true,
  },
  serverExternalPackages: ["rate-limiter-flexible"],
};

export default config;
