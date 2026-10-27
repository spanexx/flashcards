// WHY: The plan shows the last few finished sessions as a plain list, and one
// of them can start a fresh plan on the same pack and deck. The pairing and the
// cap are rules, so they live in a pure module instead of the screen.
// PACK: study-sidebar-and-history
// 2026-10-27 opencode: created for the study sidebar and history pack
// [pack: study-sidebar-and-history]

import type { SessionEvent } from "@/lib/shared/types";

/** One finished session, shaped for the plan's list. */
export interface PastSession {
  id: string;
  /** When the session ended. */
  at: string;
  offered: number;
  answered: number;
  completed: boolean;
  stopped: boolean;
  /** The pack it drew from; `""` means the whole library. Absent on old rows. */
  pack?: string;
  /** The deck id it drew from; `""` means all decks. Absent on old rows. */
  deck?: string;
}

/** The last few finished sessions, newest first, with their scope when known. */
export function recentSessions(
  events: readonly SessionEvent[],
  limit = 5,
): PastSession[] {
  const started = new Map<string, SessionEvent>();
  for (const event of events) {
    if (event.type === "started") started.set(event.id, event);
  }

  return events
    .filter((event) => event.type === "ended")
    .slice()
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, Math.max(0, limit))
    .map((event) => {
      const source = started.get(event.id);
      // WHY: The ended fact replaces the start in the store, so it usually
      // carries the scope itself; older shapes may only have it on the start.
      // Only a recorded pack can be learned again. An absent pack is an older
      // row, not a whole-library session.
      const pack = source?.pack !== undefined ? source.pack : event.pack;
      const deck = source?.pack !== undefined ? source.deck : event.deck;
      const scope = pack !== undefined ? { pack, deck: deck ?? "" } : {};
      return {
        id: event.id,
        at: event.at,
        offered: event.offered,
        answered: event.answered ?? 0,
        completed: event.completed === true,
        stopped: event.stopped === true,
        ...scope,
      };
    });
}
