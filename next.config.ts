import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without it, Next infers the root
  // from the nearest lockfile and picks up a stray ~/package-lock.json.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
