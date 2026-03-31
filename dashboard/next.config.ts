import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const appBasePath = isDev ? "" : "/dashboard";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: appBasePath,
  assetPrefix: appBasePath || undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: appBasePath,
  },
};

export default nextConfig;
