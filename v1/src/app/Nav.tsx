"use client";

// WHY: One sidebar for every screen, and one place that decides which link is
// current. Keeping this in a tiny client component lets the layout stay a
// server component while navigation still knows where the learner is.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1-prototype UI shell [pack: v1-prototype]
// 2026-10-20 opencode: static export prefetch is off; Next's RSC prefetch paths
// 404 on a plain file host. [pack: browser-app]
// 2026-10-25 opencode: the brand now carries the same Lucide mark as the
// favicon and PWA icons. [pack: learner-interface]
// 2026-10-25 opencode: the sidebar carries the one-click theme flip. [pack: learner-delight]

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeButton from "./ThemeButton";

const LINKS = [
  { href: "/", label: "Study" },
  { href: "/library", label: "Library" },
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
    <>
      <div className="sidebar-top">
        <Link className="brand" href="/" prefetch={false}>
          <BrandMark />
          <span className="brand-name">Flashcards</span>
        </Link>
        <ThemeButton />
      </div>
      <nav className="side-nav" aria-label="Main">
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
      <p className="side-foot">Local only. No account.</p>
    </>
  );
}
