import type { NextConfig } from "next";

// GitHub Pages serves a project site from /<repo>; the workflow passes that as PAGES_BASE_PATH.
const basePath = process.env.PAGES_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
