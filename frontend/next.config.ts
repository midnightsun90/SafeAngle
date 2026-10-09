import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: process.env.GITHUB_PAGES === "true" ? "/SafeAngle" : "",
  env: { NEXT_PUBLIC_BASE_PATH: process.env.GITHUB_PAGES === "true" ? "/SafeAngle" : "" },
  agentRules: false,
  turbopack: {
    root: resolve(__dirname,".."),
  },
};

export default nextConfig;
