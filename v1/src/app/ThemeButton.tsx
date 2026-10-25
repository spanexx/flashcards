"use client";

// WHY: The theme switch should be reachable in one click from any screen, not
// only from Settings. Both icons are always rendered and CSS shows the one that
// matches the painted palette, so the server HTML and the client never disagree.
// PACK: learner-delight
// 2026-10-25 opencode: created for the learner-delight pack [pack: learner-delight]

import { chooseTheme, readTheme, resolveTheme, systemPrefersDark } from "@/lib/client/theme";

export default function ThemeButton() {
  const flip = () => {
    const current = resolveTheme(readTheme(), systemPrefersDark());
    chooseTheme(current === "dark" ? "light" : "dark");
  };

  return (
    <button
      className="theme-button"
      type="button"
      onClick={flip}
      aria-label="Switch between light and dark"
      title="Light or dark"
    >
      <svg className="theme-icon theme-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
      <svg className="theme-icon theme-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    </button>
  );
}
