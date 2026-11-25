// WHY: One shell for every screen: a compact top header with the places the
// learner actually goes, and a quiet content column. Kept on an isolated
// branch so the sidebar can be restored if the experiment is rejected.
// PACK: header-nav
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-19 opencode: sidebar shell replaces the top nav [pack: v1-prototype]
// 2026-10-20 opencode: browser autosave boot and app icon [pack: browser-app]
// 2026-10-23 opencode: the job runner boots with the shell and the dock is on
// every screen. [pack: background-jobs]
// 2026-10-23 opencode: install button, manifest and service-worker boot. [pack: pwa-deploy]
// 2026-10-25 opencode: link the Lucide SVG mark and the real favicon route. [pack: pwa-deploy]
// 2026-10-25 opencode: paint the saved palette before the first frame and keep
// it live with the system. [pack: learner-delight]
// 2026-11-25 opencode: the install control moved into the header actions so it
// no longer floats over the tab row. [pack: header-nav]
// 2026-11-25 opencode: all header-nav styling now lives in one branch-only
// stylesheet, switched on by the shell--header class. [pack: header-nav]

import type { Metadata, Viewport } from "next";
import Nav from "./Nav";
import AutoSaveBoot from "./AutoSaveBoot";
import JobsBoot from "./JobsBoot";
import JobsDock from "./JobsDock";
import PwaBoot from "./PwaBoot";
import ThemeBoot from "./ThemeBoot";
import { THEME_BOOT } from "@/lib/client/theme";
import { withBasePath } from "@/lib/shared/paths";
import "./globals.css";
import "./header-nav.css";

export const metadata: Metadata = {
  title: "Flashcards",
  description: "A browser-owned flashcards app: packs, honest evidence, quiet progress.",
  applicationName: "Flashcards",
  manifest: withBasePath("/manifest.webmanifest"),
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Flashcards",
  },
  icons: {
    icon: [
      { url: withBasePath("/favicon.ico"), sizes: "any" },
      { url: withBasePath("/icon.svg"), type: "image/svg+xml" },
      { url: withBasePath("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: withBasePath("/icons/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: withBasePath("/icons/icon-192.png"), sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f5d50",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <ThemeBoot />
        <AutoSaveBoot />
        <JobsBoot />
        <PwaBoot />
        <div className="shell shell--header">
          <header className="topbar">
            <Nav />
          </header>
          <main className="content">{children}</main>
        </div>
        <JobsDock />
      </body>
    </html>
  );
}
