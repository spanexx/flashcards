// WHY: One shell for every screen: a fixed sidebar with the four places the
// learner actually goes, and a quiet content column. Compact by default so a
// screen does not become a vertical wall.
// PACK: browser-app
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-19 opencode: sidebar shell replaces the top nav [pack: v1-prototype]
// 2026-10-20 opencode: browser autosave boot and app icon [pack: browser-app]

import type { Metadata } from "next";
import Nav from "./Nav";
import AutoSaveBoot from "./AutoSaveBoot";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flashcards",
  description: "A browser-owned flashcards app: packs, honest evidence, quiet progress.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AutoSaveBoot />
        <div className="shell">
          <aside className="sidebar">
            <Nav />
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
