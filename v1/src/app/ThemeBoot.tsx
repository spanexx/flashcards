"use client";

// WHY: The head script paints the first palette, but two things must stay true
// after that: System follows the OS live, and a choice made in another tab is
// seen here. This component owns only those two listeners.
// PACK: learner-delight
// 2026-10-25 opencode: created for the learner-delight pack [pack: learner-delight]

import { useEffect } from "react";
import {
  THEME_EVENT,
  THEME_KEY,
  applyTheme,
  readTheme,
  systemPrefersDark,
} from "@/lib/client/theme";

export default function ThemeBoot() {
  useEffect(() => {
    const root = document.documentElement;
    let media: MediaQueryList | null = null;

    const paint = () => {
      applyTheme(readTheme(), root, systemPrefersDark());
    };

    // Only System should react to the OS; an explicit choice stays put.
    const watchSystem = () => {
      media?.removeEventListener("change", paint);
      media = window.matchMedia("(prefers-color-scheme: dark)");
      if (readTheme() === "system") media.addEventListener("change", paint);
    };

    const refresh = () => {
      paint();
      watchSystem();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY) refresh();
    };

    refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_EVENT, refresh);

    return () => {
      media?.removeEventListener("change", paint);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_EVENT, refresh);
    };
  }, []);

  return null;
}
