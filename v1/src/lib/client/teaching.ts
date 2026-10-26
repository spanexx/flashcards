// WHY: The teaching layer may open by itself for a beginner, but only while the
// learner wants it to. The choice is a device preference like theme and sound:
// it never enters a backup, a missing or unreadable value means "on", and a
// blocked browser store must never stop studying.
// PACK: study-resilience
// 2026-10-26 qoder: created for the study-resilience pack [pack: study-resilience]

export interface TeachingPrefs {
  autoOpen: boolean;
}

export const TEACHING_KEY = "flashcards.teaching";

/** Fired after a same-tab change so the Settings switch reflects the write. */
export const TEACHING_EVENT = "flashcards:teaching";

/** Automatic opening is on until the learner says otherwise (GRILL Q3, Q5). */
export const DEFAULT_TEACHING_PREFS: TeachingPrefs = { autoOpen: true };

function safeStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** A missing, unreadable or invalid value falls back to the default. */
export function readTeachingPrefs(
  storage: Pick<Storage, "getItem"> | null = safeStorage(),
): TeachingPrefs {
  try {
    const raw = storage?.getItem(TEACHING_KEY);
    if (!raw) return { ...DEFAULT_TEACHING_PREFS };
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { autoOpen?: unknown }).autoOpen === "boolean"
    ) {
      return { autoOpen: (parsed as { autoOpen: boolean }).autoOpen };
    }
    return { ...DEFAULT_TEACHING_PREFS };
  } catch {
    return { ...DEFAULT_TEACHING_PREFS };
  }
}

/**
 * Save the choice. A write the browser refuses is ignored in silence: the page
 * still honours the new value for this visit (GRILL Q5).
 */
export function writeTeachingAutoOpen(
  autoOpen: boolean,
  storage: Pick<Storage, "setItem"> | null = safeStorage(),
): void {
  try {
    storage?.setItem(TEACHING_KEY, JSON.stringify({ autoOpen }));
  } catch {
    // A blocked store keeps the old choice next time; nothing else changes.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TEACHING_EVENT));
}

/** The subscription the Settings switch needs, including another tab's write. */
export function subscribeTeaching(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(TEACHING_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(TEACHING_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
