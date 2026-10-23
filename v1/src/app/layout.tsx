// WHY: One shell for every screen: a fixed sidebar with the four places the
// learner actually goes, and a quiet content column. Compact by default so a
// screen does not become a vertical wall.
// PACK: browser-app
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-19 opencode: sidebar shell replaces the top nav [pack: v1-prototype]
// 2026-10-20 opencode: browser autosave boot and app icon [pack: browser-app]
// 2026-10-23 opencode: the job runner boots with the shell and the dock is on
// every screen. [pack: background-jobs]
// 2026-10-23 opencode: install button, manifest and service-worker boot. [pack: pwa-deploy]

import type { Metadata, Viewport } from "next";
import Nav from "./Nav";
import AutoSaveBoot from "./AutoSaveBoot";
import InstallButton from "./InstallButton";
import JobsBoot from "./JobsBoot";
import JobsDock from "./JobsDock";
import PwaBoot from "./PwaBoot";
import { withBasePath } from "@/lib/shared/paths";
import "./globals.css";

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
      <body>
        <AutoSaveBoot />
        <JobsBoot />
        <PwaBoot />
        <div className="shell">
          <aside className="sidebar">
            <Nav />
          </aside>
          <main className="content">{children}</main>
        </div>
        <InstallButton />
        <JobsDock />
      </body>
    </html>
  );
}
