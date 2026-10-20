// WHY: The judge is only fair if harmless differences are ignored and real
// ones are kept. These tests pin that line.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import {
  editDistance,
  isNearMatch,
  matchesAny,
  nearestDistance,
  normalizeAnswer,
} from "@/lib/core/normalize";

describe("normalizeAnswer", () => {
  it("folds case, edge punctuation and diacritics", () => {
    expect(normalizeAnswer("  Kawę! ")).toBe("kawe");
    expect(normalizeAnswer("KAWĘ")).toBe("kawe");
    expect(normalizeAnswer("kawę")).toBe("kawe");
  });

  it("folds stroked letters a keyboard may not have", () => {
    expect(normalizeAnswer("jabłko")).toBe("jablko");
    expect(normalizeAnswer("JABŁKO")).toBe("jablko");
    expect(normalizeAnswer("smørrebrød")).toBe("smorrebrod");
    expect(normalizeAnswer("straße")).toBe("strasse");
  });

  it("collapses inner whitespace", () => {
    expect(normalizeAnswer("dzień    dobry")).toBe("dzien dobry");
  });

  it("keeps case when asked, still trims punctuation at the edges", () => {
    expect(normalizeAnswer("PrintLn()", { caseSensitive: true })).toBe("PrintLn");
  });

  it("only trims in exact style, so code compares as written", () => {
    expect(normalizeAnswer("  const x = 1;  ", { exact: true })).toBe("const x = 1;");
    expect(normalizeAnswer("const x = 1;", { exact: true })).not.toBe("const x = 1");
    expect(normalizeAnswer("dzień dobry", { exact: true })).toBe("dzień dobry");
  });
});

describe("matchesAny", () => {
  it("matches any expected answer under the same rules", () => {
    expect(matchesAny("Dzień dobry", ["dzień dobry"])).toBe(true);
    expect(matchesAny("dzień dobry!", ["Dzień dobry"])).toBe(true);
    expect(matchesAny("dobry dzień", ["Dzień dobry"])).toBe(false);
  });

  it("accepts a typed answer missing diacritics, and still refuses a different word", () => {
    expect(matchesAny("Dziekuje bardzo", ["Dziękuję bardzo"])).toBe(true);
    expect(matchesAny("gdzie jest dworzec", ["Gdzie jest dworzec?"])).toBe(true);
    expect(matchesAny("jablko", ["jabłko"])).toBe(true);
    expect(matchesAny("noc", ["Dzień dobry"])).toBe(false);
  });

  it("keeps exact style strict about diacritics", () => {
    expect(matchesAny("Dziekuje", ["Dziękuję"], { exact: true })).toBe(false);
  });

  it("treats an empty answer as no match", () => {
    expect(matchesAny("", ["cokolwiek"])).toBe(false);
    expect(matchesAny("   ", ["cokolwiek"])).toBe(false);
  });

  it("honours exact style for code", () => {
    expect(matchesAny("const x = 1;", ["const x = 1;"], { exact: true })).toBe(true);
    expect(matchesAny("const x = 1", ["const x = 1;"], { exact: true })).toBe(false);
  });
});

describe("edit distance and nearness", () => {
  it("counts single letter slips", () => {
    expect(editDistance("kawa", "kawę")).toBe(1);
    expect(editDistance("kawa", "kawa")).toBe(0);
    expect(editDistance("", "abc")).toBe(3);
  });

  it("counts code points, not bytes", () => {
    expect(editDistance("łę", "lę")).toBe(1);
  });

  it("takes the nearest expected answer", () => {
    expect(nearestDistance("kawi", ["kawę", "herbatę"])).toBe(1);
    expect(nearestDistance("", ["kawę"])).toBe(Number.POSITIVE_INFINITY);
    expect(nearestDistance("kawę", [])).toBe(Number.POSITIVE_INFINITY);
  });

  it("allows one slip for short answers and two for longer ones", () => {
    expect(isNearMatch("kawi", ["kawę"])).toBe(true);
    expect(isNearMatch("kw", ["kawę"])).toBe(false);
    expect(isNearMatch("dzień dobre", ["dzień dobry"])).toBe(true);
    expect(isNearMatch("dzien dobry", ["dzień dobry"])).toBe(true);
    expect(isNearMatch("noc", ["dzień dobry"])).toBe(false);
  });

  it("never calls a near match in exact style or from an empty answer", () => {
    expect(isNearMatch("kawi", ["kawę"], { exact: true })).toBe(false);
    expect(isNearMatch("", ["kawę"])).toBe(false);
  });
});
