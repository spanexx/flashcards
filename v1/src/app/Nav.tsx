"use client";

// WHY: One header for every screen, with the same links and active rule the
// sidebar used. Kept as a tiny client component so the layout stays a server
// component while navigation still knows where the learner is.
// PACK: header-nav
// 2026-11-24 opencode: moved the five links into one top row. [pack: header-nav]

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeButton from "./ThemeButton";

const LINKS = [
  { href: "/", label: "Study" },
  { href: "/library", label: "Library" },
  { href: "/modes", label: "Learning modes" },
  { href: "/progress", label: "Progress" },
  { href: "/settings", label: "Settings" },
];

/** The Lucide Layers mark, shared by the header, favicon and PWA icons. */
function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
        <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
        <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
      </svg>
    </span>
  );
}

export default function Nav() {
  const pathname = usePathname();

  return (
    <div className="topbar-inner">
      <Link className="brand" href="/" prefetch={false}>
        <BrandMark />
        <span className="brand-name">Flashcards</span>
      </Link>
      <nav className="top-nav" aria-label="Main">
        {LINKS.map((link) => {
          const current = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              aria-current={current ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <ThemeButton />
    </div>
  );
}
