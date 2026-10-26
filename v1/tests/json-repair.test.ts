// WHY: A hand-typed import is repaired before it is refused. These tests pin
// each allowed repair, the safety of text inside strings, and the promise that
// valid JSON is never rewritten and hopeless text still errors.
// PACK: study-resilience
// 2026-10-26 opencode: created for the study resilience pack [pack: study-resilience]

import { describe, expect, it } from "vitest";
import { parseJsonLoose, repairClause, repairJson } from "@/lib/core/json-repair";

/** The kinds a repair run reported, in a stable order for comparison. */
function kinds(text: string): string[] {
  return [...repairJson(text).repairs].sort();
}

describe("one kind at a time", () => {
  it("strips a byte-order mark", () => {
    const result = parseJsonLoose("\uFEFF{\"a\": 1}");
    expect(result.value).toEqual({ a: 1 });
    expect(result.repairs).toEqual(["bom"]);
  });

  it("unwraps one markdown fence with a language word", () => {
    const result = parseJsonLoose("```json\n{\"a\": 1}\n```");
    expect(result.value).toEqual({ a: 1 });
    expect(result.repairs).toEqual(["code-fence"]);
  });

  it("unwraps a plain markdown fence", () => {
    const result = parseJsonLoose("```\n{\"a\": 1}\n```");
    expect(result.value).toEqual({ a: 1 });
    expect(result.repairs).toEqual(["code-fence"]);
  });

  it("turns curly double quotes into quotes", () => {
    const result = parseJsonLoose("{“a”: “b”}");
    expect(result.value).toEqual({ a: "b" });
    expect(result.repairs).toEqual(["smart-quotes"]);
  });

  it("removes line and block comments", () => {
    const result = parseJsonLoose("{\n// first\n\"a\": 1, /* second */\n\"b\": 2\n}");
    expect(result.value).toEqual({ a: 1, b: 2 });
    expect(result.repairs).toEqual(["comments"]);
  });

  it("removes a trailing comma", () => {
    const result = parseJsonLoose('{"a": 1, "b": [1, 2,],}');
    expect(result.value).toEqual({ a: 1, b: [1, 2] });
    expect(result.repairs).toEqual(["trailing-comma"]);
  });

  it("quotes a bare object key", () => {
    const result = parseJsonLoose("{a: 1, $b_2: 2}");
    expect(result.value).toEqual({ a: 1, $b_2: 2 });
    expect(result.repairs).toEqual(["unquoted-key"]);
  });

  it("turns a single-quoted string into a double-quoted one", () => {
    const result = parseJsonLoose("{\"a\": 'b'}");
    expect(result.value).toEqual({ a: "b" });
    expect(result.repairs).toEqual(["single-quoted-string"]);
  });

  it("handles a single-quoted key without also calling it a bare key", () => {
    const result = parseJsonLoose("{'a': 1}");
    expect(result.value).toEqual({ a: 1 });
    expect(result.repairs).toEqual(["single-quoted-string"]);
  });

  it("keeps an escaped apostrophe as an apostrophe", () => {
    const result = parseJsonLoose("{'text': 'It\\'s fine'}");
    expect(result.value).toEqual({ text: "It's fine" });
  });

  it("escapes a double quote inside a single-quoted string", () => {
    const result = parseJsonLoose("{'text': 'say \"hi\"'}");
    expect(result.value).toEqual({ text: 'say "hi"' });
  });
});

describe("everything at once", () => {
  it("applies all seven kinds in one pass", () => {
    const text = [
      "\uFEFF```json",
      "{",
      "  // hand typed",
      "  pack: 'starter',",
      '  "text": “Piję kawę”,',
      "}",
      "```",
    ].join("\n");
    const result = parseJsonLoose(text);
    expect(result.value).toEqual({ pack: "starter", text: "Piję kawę" });
    expect(result.repairs).toHaveLength(7);
    expect(result.repairs).toEqual(
      expect.arrayContaining([
        "bom",
        "code-fence",
        "smart-quotes",
        "comments",
        "trailing-comma",
        "unquoted-key",
        "single-quoted-string",
      ]),
    );
  });
});

describe("text inside strings is never rewritten", () => {
  it("keeps curly quotes inside a straight-quoted string", () => {
    const result = parseJsonLoose('{"summary": "She said “hi”", "count": 2,}');
    expect(result.value).toEqual({ summary: "She said “hi”", count: 2 });
    expect(result.repairs).toEqual(["trailing-comma"]);
  });

  it("keeps curly apostrophes inside a valid document untouched", () => {
    const text = '{"text": "It’s “fine”"}';
    expect(parseJsonLoose(text).value).toEqual({ text: "It’s “fine”" });
    expect(parseJsonLoose(text).repairs).toEqual([]);
  });

  it("keeps commas, braces and escaped quotes inside a string", () => {
    const text = String.raw`{"text": "a, b } ] \"quoted\" \\ back", "n": 1,}`;
    const result = parseJsonLoose(text);
    expect(result.value).toEqual({ text: 'a, b } ] "quoted" \\ back', n: 1 });
    expect(result.repairs).toEqual(["trailing-comma"]);
  });

  it("leaves an apostrophe inside a double-quoted string alone", () => {
    const result = parseJsonLoose('{"text": "It\'s fine, isn\'t it?", "n": 1,}');
    expect(result.value).toEqual({ text: "It's fine, isn't it?", n: 1 });
    expect(result.repairs).toEqual(["trailing-comma"]);
  });

  it("does not quote a word that merely looks like a key inside a string", () => {
    const result = parseJsonLoose('{"text": "a: b, c: d", x: 1}');
    expect(result.value).toEqual({ text: "a: b, c: d", x: 1 });
    expect(result.repairs).toEqual(["unquoted-key"]);
  });
});

describe("valid JSON and hopeless JSON", () => {
  it("returns valid JSON exactly as it came, with no repairs", () => {
    const text = '{"a": [1, 2, {"b": "it\'s, ok"}], "c": null}';
    const repaired = repairJson(text);
    expect(repaired.text).toBe(text);
    expect(repaired.repairs).toEqual([]);
    expect(parseJsonLoose(text)).toEqual({
      value: { a: [1, 2, { b: "it's, ok" }], c: null },
      repairs: [],
    });
  });

  it("is idempotent: a repair run twice changes nothing the second time", () => {
    const once = repairJson("{pack: 'starter', " + '“text”: “hi”,' + "}");
    expect(once.repairs.length).toBeGreaterThan(0);
    const twice = repairJson(once.text);
    expect(twice.text).toBe(once.text);
    expect(twice.repairs).toEqual([]);
  });

  it("is idempotent on text that cannot be repaired", () => {
    const once = repairJson("{cards: [");
    const twice = repairJson(once.text);
    expect(twice.text).toBe(once.text);
    expect(twice.repairs).toEqual([]);
  });

  it("throws the plain wording for truncated text", () => {
    expect(() => parseJsonLoose('{"cards": [')).toThrow(/not valid JSON/);
  });

  it("says that repair was tried when it was", () => {
    let message = "";
    try {
      parseJsonLoose("{cards: [");
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toContain("not valid JSON");
    expect(message).toContain("syntax repair was tried first");
  });

  it("parses a bare array: shape rules belong to the caller", () => {
    expect(parseJsonLoose("[1, 2, 3]")).toEqual({ value: [1, 2, 3], repairs: [] });
    expect(kinds("[“a”, 'b']")).toEqual(["single-quoted-string", "smart-quotes"]);
  });
});

describe("repairClause", () => {
  it("reads as one plain sentence, or nothing for a clean file", () => {
    expect(repairClause([])).toBeNull();
    expect(repairClause(undefined)).toBeNull();
    expect(repairClause(["smart-quotes", "trailing-comma"])).toBe(
      "Repaired smart quotes and a trailing comma",
    );
    expect(repairClause(["comments"])).toBe("Repaired comments");
    expect(repairClause(["bom", "comments", "trailing-comma"])).toBe(
      "Repaired a byte-order mark, comments and a trailing comma",
    );
  });
});
