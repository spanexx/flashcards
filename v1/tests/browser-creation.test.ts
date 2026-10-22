// WHY: Learner-written labels and provider-written names both end up as pack
// names, deck ids and deck labels. These tests pin the one naming rule so a
// generated collision can never overwrite a deck the learner already has.
// PACK: library-create-flow
// 2026-10-21 opencode: created for the target-first Create flow.

import { describe, expect, it } from "vitest";
import { slugFromName, uniqueDeckIdentity, uniquePackName } from "@/lib/browser/creation";

describe("creation names", () => {
  it("turns a learner label into the existing slug shape", () => {
    expect(slugFromName("Slow Polish Basics")).toBe("slow-polish-basics");
    expect(slugFromName("Łódź, 101")).toBe("lodz-101");
    expect(slugFromName("  ")).toBe("item");
    expect(slugFromName("  ", "deck")).toBe("deck");
  });

  it("takes the first free pack suffix", () => {
    expect(uniquePackName("starter", ["starter", "starter-2"])).toBe("starter-3");
    expect(uniquePackName("fresh", ["starter"])).toBe("fresh");
  });

  it("keeps a generated deck id and label paired on a collision", () => {
    expect(uniqueDeckIdentity("basics", "Basics", [{ id: "basics", name: "Basics" }])).toEqual({
      id: "basics-2",
      name: "Basics 2",
    });
    expect(
      uniqueDeckIdentity("basics", "Basics", [
        { id: "basics-2", name: "Basics 2" },
        { id: "basics", name: "Basics" },
      ]),
    ).toEqual({ id: "basics-3", name: "Basics 3" });
  });
});
