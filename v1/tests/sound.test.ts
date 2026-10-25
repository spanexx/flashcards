// WHY: Sound must be predictable: only the outcomes with a meaning get a cue,
// the table never produces a silent or out-of-order note, and the preference is
// off unless it says "on". These are the parts a browser cannot pin cheaply.
// PACK: learner-delight
// 2026-10-25 opencode: created for the learner-delight pack [pack: learner-delight]

import { describe, expect, it } from "vitest";
import {
  SOUND_KEY,
  cueForOutcome,
  cueNotes,
  isSoundOn,
  setSoundOn,
  type SoundCue,
} from "@/lib/client/sound";

const CUES: SoundCue[] = ["got_it", "nearly", "missed", "finish"];

describe("cue selection", () => {
  it("maps every judged outcome to a cue", () => {
    expect(cueForOutcome("got_it")).toBe("got_it");
    expect(cueForOutcome("nearly")).toBe("nearly");
    expect(cueForOutcome("again")).toBe("missed");
    expect(cueForOutcome("no")).toBe("missed");
  });

  it("stays quiet when the outcome says nothing useful", () => {
    expect(cueForOutcome("unjudged")).toBeNull();
    expect(cueForOutcome("")).toBeNull();
    expect(cueForOutcome("got_it_but_not_really")).toBeNull();
  });
});

describe("the note table", () => {
  it("gives every cue at least one quiet note", () => {
    for (const cue of CUES) {
      const notes = cueNotes(cue);
      expect(notes.length).toBeGreaterThan(0);
      for (const note of notes) {
        expect(Number.isFinite(note.freq)).toBe(true);
        expect(note.freq).toBeGreaterThan(0);
        expect(note.start).toBeGreaterThanOrEqual(0);
        expect(note.length).toBeGreaterThan(0);
        expect(note.gain).toBeGreaterThan(0);
        expect(note.gain).toBeLessThanOrEqual(0.06);
      }
    }
  });

  it("orders the notes in time", () => {
    for (const cue of CUES) {
      const starts = cueNotes(cue).map((note) => note.start);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
    }
  });

  it("closes the session on three rising notes", () => {
    const finish = cueNotes("finish");
    expect(finish).toHaveLength(3);
    expect(finish[0].freq).toBeLessThan(finish[1].freq);
    expect(finish[1].freq).toBeLessThan(finish[2].freq);
  });

  it("hands out copies, so a caller cannot edit the table", () => {
    const first = cueNotes("got_it");
    first[0].freq = 1;
    expect(cueNotes("got_it")[0].freq).toBeGreaterThan(1);
  });
});

describe("the preference", () => {
  it("is off until it is turned on", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    expect(isSoundOn(storage)).toBe(false);
    setSoundOn(true, storage);
    expect(store.get(SOUND_KEY)).toBe("on");
    expect(isSoundOn(storage)).toBe(true);
    setSoundOn(false, storage);
    expect(isSoundOn(storage)).toBe(false);
  });

  it("treats a blocked store as off, never as an error", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(isSoundOn(blocked)).toBe(false);
    expect(isSoundOn(null)).toBe(false);
  });
});
