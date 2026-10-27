// WHY: Enter moves to the next card only when nothing else owns the press.
// A focused button, a held key or an already-handled event must keep its own
// meaning, so the rule is pinned outside React.
// PACK: session-advance
// 2026-10-27 opencode: created with the session-advance pack [pack: session-advance]

import { describe, expect, it } from "vitest";
import { isAdvanceKey } from "@/lib/client/advance-key";

const plainEnter = { key: "Enter", repeat: false, defaultPrevented: false };

describe("advance key", () => {
  it("continues on a plain Enter", () => {
    expect(isAdvanceKey(plainEnter, false)).toBe(true);
  });

  it("ignores other keys", () => {
    expect(isAdvanceKey({ ...plainEnter, key: " " }, false)).toBe(false);
    expect(isAdvanceKey({ ...plainEnter, key: "Escape" }, false)).toBe(false);
  });

  it("ignores a held key", () => {
    expect(isAdvanceKey({ ...plainEnter, repeat: true }, false)).toBe(false);
  });

  it("ignores a press a control or handler already owns", () => {
    expect(isAdvanceKey(plainEnter, true)).toBe(false);
    expect(isAdvanceKey({ ...plainEnter, defaultPrevented: true }, false)).toBe(false);
  });
});
