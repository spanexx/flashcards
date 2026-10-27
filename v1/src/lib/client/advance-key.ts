// WHY: Enter has two jobs after an answer: continue in the app and activate
// whatever control has focus. This predicate keeps the rule in one place, away
// from React, so a focused link or a held key never skips a card.
// PACK: session-advance

/** The parts of a key press that decide whether Enter may move on. */
export interface AdvanceKeyEvent {
  key: string;
  repeat: boolean;
  defaultPrevented: boolean;
}

/** True when Enter should continue, and no control or handler owns the press. */
export function isAdvanceKey(event: AdvanceKeyEvent, onControl: boolean): boolean {
  return event.key === "Enter" && !event.repeat && !event.defaultPrevented && !onControl;
}
