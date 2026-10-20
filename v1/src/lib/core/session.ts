// WHY: Abandonment is evidence, not a verdict. Consistently stopping early
// lowers the offer; finishing raises it. Nothing about this appears during a
// session, and there is never a streak or a telling-off.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import type { SessionEvent } from "@/lib/shared/types";

/** The default offer and the floor the offer never drops below. */
export const DEFAULT_OFFER = 20;
export const MINIMUM_OFFER = 5;

/**
 * The offer the learner sees. It is an offer, never a rule. Two or more recent
 * short stops lower it by five once, to the floor; each finished session then
 * raises it back toward the base. Nothing here appears during a session.
 */
export function computeOffer(
  events: SessionEvent[],
  base = DEFAULT_OFFER,
  floor = MINIMUM_OFFER,
): number {
  const ended = events
    .filter((event) => event.type === "ended")
    .sort((left, right) => left.at.localeCompare(right.at))
    .slice(-5);

  const shortStops = ended.filter(
    (event) => event.stopped === true && (event.answered ?? 0) < event.offered * 0.5,
  ).length;
  const finished = ended.filter((event) => event.completed === true).length;

  let offer = base;
  if (shortStops >= 2) offer = Math.max(floor, offer - 5);
  offer = Math.min(base, offer + finished * 5);
  return offer;
}
