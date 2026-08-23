import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Turbopack from statically bundling native/optional server-only packages.
  // puppeteer-core and sharp are used only in API routes (server-side) and must not
  // be traced/bundled by the client build pipeline.
  serverExternalPackages: ['puppeteer-core', 'puppeteer', 'sharp'],
};

export default nextConfig;
