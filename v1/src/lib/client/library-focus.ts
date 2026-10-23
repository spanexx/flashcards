// WHY: A job notice can point at a pack while Library is already mounted. The
// URL still carries the destination for a new tab; this event lets the mounted
// screen focus without a reload that would stop another job.
// PACK: background-jobs
// 2026-10-23 opencode: created for the background job pack [pack: background-jobs]

export const LIBRARY_FOCUS_EVENT = "flashcards:library-focus";

export interface LibraryFocus {
  packName: string;
  deckId?: string;
}

/** Ask the mounted Library to show one pack or deck. Safe outside a browser. */
export function focusLibrary(focus: LibraryFocus): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<LibraryFocus>(LIBRARY_FOCUS_EVENT, { detail: focus }));
}
