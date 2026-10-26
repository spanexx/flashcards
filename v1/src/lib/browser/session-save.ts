// WHY: A session snapshot changes on every keystroke, and an IndexedDB write
// takes longer than a keystroke. One pending snapshot holds the newest state,
// writes run one at a time so the newest always lands last, and a page hide can
// force the pending write out before the tab goes away (GRILL Q7).
// PACK: study-resilience
// 2026-10-26 qoder: created for the study-resilience pack [pack: study-resilience]

import {
  clearStoredSession,
  readCards,
  readStoredSession,
  writeStoredSession,
} from "@/lib/browser/repository";
import { parseStoredSession, pruneStoredSession, type StoredSession } from "@/lib/core/session-resume";

/** A short pause so a burst of typing becomes one write. */
const SAVE_DELAY_MS = 300;

let pending: StoredSession | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
/** Writes finish in the order they started, so no older snapshot can win. */
let chain: Promise<void> = Promise.resolve();

function stopTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Write whatever is pending now; resolves after every started write settled. */
function writePending(): Promise<void> {
  stopTimer();
  const snapshot = pending;
  if (!snapshot) return chain;
  pending = null;
  chain = chain
    .then(
      () => writeStoredSession(snapshot),
      // A previous failure must not stop the next write.
      () => writeStoredSession(snapshot),
    )
    .then(
      () => undefined,
      // A blocked store keeps the previous snapshot; studying never stops for it.
      () => undefined,
    );
  return chain;
}

/** Remember the newest snapshot. Only the last one queued before the pause wins. */
export function queueSessionSave(session: StoredSession): void {
  pending = session;
  stopTimer();
  timer = setTimeout(() => {
    void writePending();
  }, SAVE_DELAY_MS);
}

/** Write the pending snapshot at once, for a page hide or an unmount. */
export async function flushSessionSave(): Promise<void> {
  await writePending();
}

/**
 * Drop a pending snapshot and wait for any write already in flight, so a
 * clear that follows it cannot be overtaken by a stale snapshot.
 */
export function cancelSessionSave(): Promise<void> {
  pending = null;
  stopTimer();
  return chain;
}

/**
 * Read, validate and prune the stored snapshot against the cards that exist
 * now. A row that is unreadable or has nothing left to show is cleared, and the
 * caller falls back to the plan screen (GRILL Q8, Q9).
 */
export async function loadResumableSession(): Promise<StoredSession | null> {
  try {
    // WHY: Leaving the screen starts a write. A quick return must not read the
    // row before that write lands, or it would resume one keystroke behind.
    await chain;
    const raw = await readStoredSession();
    if (!raw) return null;
    const parsed = parseStoredSession(raw);
    if (!parsed) {
      await clearStoredSession();
      return null;
    }
    const cards = await readCards();
    // WHY: editing a card retires the old row and writes a new identity, so a
    // retired id must count as gone or the session resumes the pre-edit card.
    const liveIds = new Set(cards.filter((card) => !card.retired).map((card) => card.id));
    const pruned = pruneStoredSession(parsed, liveIds);
    if (!pruned) {
      await clearStoredSession();
      return null;
    }
    // A shortened queue is written back so a second reload prunes nothing.
    if (pruned.queue.length !== parsed.queue.length) await writeStoredSession(pruned);
    return pruned;
  } catch {
    // An unreadable store must never block the plan screen.
    return null;
  }
}
