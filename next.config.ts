import type { NextConfig } from "next";

// Static export: the Android app bundles these files and loads them locally.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
