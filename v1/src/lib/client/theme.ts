// WHY: The palette was tied to the operating system with no way to choose it.
// The learner asked for a real light mode, so the choice becomes a device
// preference: resolved before the first paint, remembered locally, and never
// confused with learner data that belongs in a backup.
// PACK: learner-delight
// 2026-10-25 opencode: created for the learner-delight pack [pack: learner-delight]

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "flashcards.theme";

/** Fired after a same-tab change so the live OS watcher can re-arm itself. */
export const THEME_EVENT = "flashcards:theme";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

/** The only shapes storage may return; anything else means "follow the OS". */
export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

export function themeLabel(choice: ThemeChoice): string {
  if (choice === "light") return "Light";
  if (choice === "dark") return "Dark";
  return "System";
}

/** localStorage can throw when a host blocks it; that is not an app error. */
function safeStorage(): Pick<Storage, "getItem"> | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** A missing or unreadable preference follows the OS, never a crash. */
export function readTheme(storage: Pick<Storage, "getItem"> | null = safeStorage()): ThemeChoice {
  try {
    const saved = storage?.getItem(THEME_KEY);
    return isThemeChoice(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

/** System resolves to the OS palette; an explicit choice ignores the OS. */
export function resolveTheme(choice: ThemeChoice, systemDark: boolean): ResolvedTheme {
  if (choice === "light") return "light";
  if (choice === "dark") return "dark";
  return systemDark ? "dark" : "light";
}

/** The small part of <html> this module needs, so the rule stays testable. */
export interface ThemeRoot {
  dataset: Record<string, string | undefined>;
  style: { colorScheme: string };
}

/** Put the resolved palette on the root; the stored choice stays "system". */
export function applyTheme(
  choice: ThemeChoice,
  root: ThemeRoot,
  systemDark: boolean,
): ResolvedTheme {
  const resolved = resolveTheme(choice, systemDark);
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  return resolved;
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Save the choice and paint it at once, so a click never waits for a reload. */
export function chooseTheme(choice: ThemeChoice, systemDark = systemPrefersDark()): ResolvedTheme {
  try {
    window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // A blocked store still changes this page; it just will not be remembered.
  }
  const resolved = applyTheme(choice, document.documentElement, systemDark);
  window.dispatchEvent(new Event(THEME_EVENT));
  return resolved;
}

/**
 * The subscription a Settings control needs: its own tab hears the choice it
 * just made, and another tab's change arrives as a storage event.
 */
export function subscribeTheme(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// WHY: This string runs in <head> before React and before the first paint, so
// a dark-preferring learner never sees a light flash. It is duplicated logic on
// purpose: importing the module here would run after paint.
export const THEME_BOOT = `(function(){var r="light";try{var s=localStorage.getItem("${THEME_KEY}");r=s==="light"?"light":s==="dark"?"dark":(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");}catch(e){}var el=document.documentElement;el.dataset.theme=r;el.style.colorScheme=r;})();`;
