// WHY: The redesigned Study screen states its offer in words and its position
// in pips. Keeping the words and the pip states in one pure module lets the
// screen stay presentational and lets the awkward edges be tested.
// PACK: study-tab-redesign
// 2026-10-25 opencode: created for the Study redesign [pack: study-tab-redesign]

/** How many cards the plan holds, said in one calm line. */
export function planHeadline(count: number): string {
  return `${count} ${count === 1 ? "card is" : "cards are"} laid out.`;
}

/** Where the cards come from, and the promise that stopping is allowed. */
export function planLede(scopeText: string): string {
  return `From ${scopeText}. It's an offer — stop whenever you like.`;
}

export type PipState = "done" | "now" | "future";

/**
 * One state per card in the session: earlier cards are done, the current card
 * is now, later cards are future. An over-run index keeps the last pip marked
 * so the row never loses its "where am I" cue.
 */
export function pipStates(index: number, total: number): PipState[] {
  if (total <= 0) return [];
  const current = Math.min(Math.max(index, 0), total - 1);
  return Array.from({ length: total }, (_, position) => {
    if (position < current) return "done";
    if (position === current) return "now";
    return "future";
  });
}
