import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/shared/paths";

// WHY: The app is a static page first. Everything the learner owns lives in the
// browser, so the build writes plain files that any host can serve, with no
// server process behind them.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: static export for the browser-owned build.
// 2026-10-20 opencode: trailing slashes so a plain file server finds
// /library/index.html; no host rewrite rules are needed. [pack: browser-app]
// 2026-10-23 opencode: basePath for the GitHub Pages project site. [pack: pwa-deploy]
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: BASE_PATH || undefined,
};

export default nextConfig;
