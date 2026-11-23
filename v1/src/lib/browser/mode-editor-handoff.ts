// WHY: Navigating to a full-page editor unmounts the list screen. An unsaved AI
// draft and the return notice need a small, guarded place to survive that trip.
// PACK: mode-editor-design
// 2026-11-23 opencode: created for the full-page editor handoff. [pack: mode-editor-design]

import type { LearningMode } from "@/lib/shared/types";

const DRAFT_KEY = "flashcards:mode-draft";
const NOTICE_KEY = "flashcards:mode-notice";

/** Session storage can be unavailable in locked-down browsers; never throw. */
function session(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Hold an unsaved draft until the editor page reads it. */
export function saveModeDraft(mode: LearningMode): void {
  session()?.setItem(DRAFT_KEY, JSON.stringify(mode));
}

/** Take the held draft once, so a reload cannot reopen a stale draft. */
export function takeModeDraft(): LearningMode | null {
  const store = session();
  if (!store) return null;
  const text = store.getItem(DRAFT_KEY);
  if (!text) return null;
  store.removeItem(DRAFT_KEY);
  try {
    return JSON.parse(text) as LearningMode;
  } catch {
    return null;
  }
}

/** Carry a short notice back to the list after a save. */
export function saveModeNotice(text: string): void {
  session()?.setItem(NOTICE_KEY, text);
}

/** Read and clear the return notice on list mount. */
export function takeModeNotice(): string | null {
  const store = session();
  if (!store) return null;
  const text = store.getItem(NOTICE_KEY);
  if (text) store.removeItem(NOTICE_KEY);
  return text;
}
