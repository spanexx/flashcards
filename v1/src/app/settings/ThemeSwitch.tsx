"use client";

// WHY: System is a real choice, not a missing value, so it needs a control of
// its own rather than a two-state toggle. The subscription reads storage as the
// external source and starts at System on the server, so hydration stays clean
// and the control follows the sidebar button without a copy of the state.
// PACK: learner-delight
// 2026-10-25 opencode: created for the learner-delight pack [pack: learner-delight]
// 2026-10-25 opencode: reads the saved choice through useSyncExternalStore.
// [pack: learner-delight]

import { useSyncExternalStore } from "react";
import {
  THEME_CHOICES,
  chooseTheme,
  readTheme,
  subscribeTheme,
  themeLabel,
  type ThemeChoice,
} from "@/lib/client/theme";

const SERVER_CHOICE = (): ThemeChoice => "system";

export default function ThemeSwitch() {
  const choice = useSyncExternalStore(subscribeTheme, readTheme, SERVER_CHOICE);

  return (
    <div className="theme-choice" role="group" aria-label="Colour theme">
      {THEME_CHOICES.map((option) => (
        <button
          key={option}
          className="theme-choice-option"
          type="button"
          aria-pressed={choice === option}
          onClick={() => chooseTheme(option)}
        >
          {themeLabel(option)}
        </button>
      ))}
    </div>
  );
}
