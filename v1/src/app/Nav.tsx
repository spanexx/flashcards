"use client";

// WHY: One sidebar for every screen, and one place that decides which link is
// current. Keeping this in a tiny client component lets the layout stay a
// server component while navigation still knows where the learner is.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1-prototype UI shell [pack: v1-prototype]
// 2026-10-20 opencode: static export prefetch is off; Next's RSC prefetch paths
// 404 on a plain file host. [pack: browser-app]

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Study" },
  { href: "/library", label: "Library" },
  { href: "/progress", label: "Progress" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
      <Link className="brand" href="/" prefetch={false}>
        Flashcards
      </Link>
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
