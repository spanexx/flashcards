"use client";

// WHY: One header for every screen, with the same links and active rule the
// sidebar used. Kept as a tiny client component so the layout stays a server
// component while navigation still knows where the learner is.
// PACK: header-nav
// 2026-11-24 opencode: moved the five links into one top row. [pack: header-nav]
// 2026-11-25 opencode: made the links read as tabs and gave the install control
// the same quiet button shape as the theme switch. [pack: header-nav]
// 2026-11-25 opencode: the active tab scrolls into view on a narrow row. [pack: header-nav]
// 2026-11-25 opencode: phones get a menu button in the header instead of a
// scrolling tab row. [pack: header-nav]

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import InstallButton from "./InstallButton";
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
  const navRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // WHY: storing the route that opened the menu means a route change closes it
  // by itself, including browser Back, without a state write inside an effect.
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  const closeMenu = useCallback(() => setMenuPath(null), []);
  const toggleMenu = useCallback(
    () => setMenuPath((current) => (current === pathname ? null : pathname)),
    [pathname],
  );

  useEffect(() => {
    // WHY: on desktop the tab row brings the current route into view.
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
    if (!active) return;
    const left =
      active.getBoundingClientRect().left -
      nav.getBoundingClientRect().left +
      nav.scrollLeft -
      12;
    nav.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    // WHY: a menu that covers the page must close on Escape or a tap outside,
    // otherwise a learner has to hunt for the tiny button again.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen, closeMenu]);

  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="topbar-inner">
      <Link className="brand" href="/" prefetch={false}>
        <BrandMark />
        <span className="brand-name">Flashcards</span>
      </Link>
      <nav className="top-nav" aria-label="Main" ref={navRef}>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            prefetch={false}
            aria-current={isCurrent(link.href) ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="top-actions">
        {/* WHY: the phone menu lives with the other header controls, so the
            same right-hand group holds navigation, install and theme. */}
        <div className="menu-wrap" ref={menuRef}>
          <button
            className="menu-button"
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={toggleMenu}
          >
            {menuOpen ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
          {menuOpen ? (
            <nav className="mobile-menu" id="mobile-menu" aria-label="Main menu">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  aria-current={isCurrent(link.href) ? "page" : undefined}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        {/* WHY: The install control now sits in the header instead of floating
            over the page, so all right-hand controls share one row and size. */}
        <InstallButton />
        <ThemeButton />
      </div>
    </div>
  );
}
