import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  turbopack: {
    root: resolve(process.cwd(), ".."),
  },
};

export default nextConfig;
