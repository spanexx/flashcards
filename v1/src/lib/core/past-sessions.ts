// WHY: The plan shows the last few finished sessions as a plain list, and one
// of them can start a fresh plan on the same source. The pairing and the cap are
// rules, so they live in a pure module instead of the screen.
// PACK: study-sidebar-and-history, plan-multi-select
// 2026-10-27 opencode: created for the study sidebar and history pack
// [pack: study-sidebar-and-history]
// 2026-10-27 opencode: a session may name many packs and decks, so the list
// carries the whole scope instead of one pack and deck. [pack: plan-multi-select]

import type { PlanScope, SessionEvent } from "@/lib/shared/types";

/** One finished session, shaped for the plan's list. */
export interface PastSession {
  id: string;
  /** When the session ended. */
  at: string;
  offered: number;
  answered: number;
  completed: boolean;
  stopped: boolean;
  /**
   * The packs and decks it drew from. Empty means the whole library. Absent on
   * rows from before scopes were recorded, which are not replayable.
   */
  scope?: PlanScope;
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
      const scope = source?.scope !== undefined ? source.scope : event.scope;
      const pack = source?.pack !== undefined ? source.pack : event.pack;
      const deck = source?.pack !== undefined ? source.deck : event.deck;
      // Only a recorded scope or pack can be learned again. An absent pack on a
      // row without a scope is an older row, not a whole-library session.
      const legacy = pack !== undefined ? { pack, deck: deck ?? "" } : {};
      return {
        id: event.id,
        at: event.at,
        offered: event.offered,
        answered: event.answered ?? 0,
        completed: event.completed === true,
        stopped: event.stopped === true,
        ...(scope !== undefined ? { scope } : {}),
        ...legacy,
      };
    });
}
