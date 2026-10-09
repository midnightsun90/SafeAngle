import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: process.env.GITHUB_PAGES === "true" ? "/SafeAngle" : "",
  agentRules: false,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
