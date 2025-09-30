import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    externalDir: true,
  },
  serverExternalPackages: [
    "rate-limiter-flexible",
    "@sebastianwessel/quickjs",
    "@jitl/quickjs-ng-wasmfile-release-sync",
  ],
};

export default config;
