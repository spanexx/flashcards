// WHY: The full-page editor keeps every decision in pure helpers so the node
// test suite can prove them without rendering React.
// PACK: mode-editor-design
// 2026-11-23 opencode: created RED before the helper module. [pack: mode-editor-design]

import { describe, expect, it } from "vitest";
import { PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import type { LearningMode } from "@/lib/shared/types";
import {
  blankArrayItem,
  deleteAt,
  highlightJson,
  initialTabFromSearch,
  isReadOnlyModeField,
  isSkillInstructionsLink,
  mirrorJsonText,
  modeWithExampleText,
  pathText,
  renameKeyAt,
  renderMarkdown,
  setAt,
  treeRowsFor,
} from "@/app/modes/mode-editor-utils";

function mode(): LearningMode {
  return {
    id: "grammar-roles",
    name: "Grammar roles",
    description: "Study the jobs words do.",
    version: "1.0.0",
    defaultCardMix: ["cloze", "picks", "type"],
    usesWordStages: false,
    skillInstructions: "# Grammar roles\n\n- Name each role.",
    canonicalExample: {
      schema: PACK_BUNDLE_SCHEMA,
      pack: { name: "mode-demo-grammar-roles", version: "1.0.0" },
      decks: [{ id: "doer", name: "Doer" }],
      cards: [],
      words: [],
      pages: [],
    },
    isBuiltIn: false,
    createdAt: "2026-11-23T00:00:00.000Z",
  };
}

describe("immutable tree edits", () => {
  it("sets a nested value without mutating the original", () => {
    const original = mode();
    const next = setAt(original, ["canonicalExample", "pack", "version"], "2.0.0") as LearningMode;
    expect(next.canonicalExample).toMatchObject({ pack: { version: "2.0.0" } });
    expect(original.canonicalExample).toMatchObject({ pack: { version: "1.0.0" } });
  });

  it("splices arrays and omits object keys", () => {
    const one = deleteAt(mode(), ["defaultCardMix", 1]) as LearningMode;
    expect(one.defaultCardMix).toEqual(["cloze", "type"]);
    const two = deleteAt(mode(), ["description"]) as LearningMode;
    expect("description" in two).toBe(false);
  });

  it("renames a key while keeping order", () => {
    const next = renameKeyAt(mode(), ["canonicalExample", "pack"], "bundle") as {
      canonicalExample: Record<string, unknown>;
    };
    expect(Object.keys(next.canonicalExample)).toEqual([
      "schema", "bundle", "decks", "cards", "words", "pages",
    ]);
  });

  it("mirrors the object as pretty JSON", () => {
    expect(mirrorJsonText(mode())).toBe(JSON.stringify(mode(), null, 2));
  });
});

describe("adding an array entry", () => {
  it("uses a blank value instead of copying the first item", () => {
    expect(blankArrayItem([{ id: "doer", name: "Doer" }])).toEqual({});
    expect(blankArrayItem(["cloze", "picks"])).toBe("");
    expect(blankArrayItem([3])).toBe(0);
    expect(blankArrayItem([true])).toBe(false);
    expect(blankArrayItem([])).toBe("");
  });
});

describe("app-owned fields", () => {
  it("locks every field the router owns and the protocol literal", () => {
    expect(isReadOnlyModeField(["id"])).toBe(true);
    expect(isReadOnlyModeField(["isBuiltIn"])).toBe(true);
    expect(isReadOnlyModeField(["createdAt"])).toBe(true);
    expect(isReadOnlyModeField(["sourceModeId"])).toBe(true);
    expect(isReadOnlyModeField(["canonicalExample", "schema"])).toBe(true);
    expect(isReadOnlyModeField(["name"])).toBe(false);
    expect(isReadOnlyModeField(["canonicalExample", "pack", "name"])).toBe(false);
    const row = treeRowsFor(mode()).find((item) => pathText(item.path) === "mode / isBuiltIn");
    expect(row?.readOnly).toBe(true);
  });
});

describe("tree presentation helpers", () => {
  it("flags only the top-level skill text as a link", () => {
    expect(isSkillInstructionsLink(["skillInstructions"])).toBe(true);
    expect(isSkillInstructionsLink(["description"])).toBe(false);
    expect(isSkillInstructionsLink(["canonicalExample", "skillInstructions"])).toBe(false);
  });

  it("builds a readable path and rows with auto-open branches", () => {
    expect(pathText(["canonicalExample", "pack"])).toBe("mode / canonicalExample / pack");
    const rows = treeRowsFor(mode());
    expect(rows.find((row) => row.path.length === 0)?.autoOpen).toBe(true);
    expect(rows.find((row) => pathText(row.path) === "mode / canonicalExample")?.autoOpen).toBe(true);
    expect(rows.some((row) => row.kind === "leaf" && row.label === "version")).toBe(true);
  });
});

describe("rendering helpers", () => {
  it("escapes HTML before adding colour spans", () => {
    const html = highlightJson('{"x":"<script>"}');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders markdown headings, bullets, bold and code", () => {
    const html = renderMarkdown("# Title\n\n- a **bold** and `code` line\n\n<b>raw</b>");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).not.toContain("<b>raw</b>");
  });

  it("defaults the deep link to the skill tab", () => {
    expect(initialTabFromSearch("?tab=json")).toBe("json");
    expect(initialTabFromSearch("?tab=other")).toBe("skill");
    expect(initialTabFromSearch("")).toBe("skill");
  });
});

describe("the one save gate", () => {
  it("refuses invalid example text and accepts a valid object", () => {
    const bad = modeWithExampleText(mode(), "{oops");
    expect(bad).toMatchObject({ ok: false, issue: "canonicalExample: this must be JSON" });
    const good = modeWithExampleText(mode(), JSON.stringify(mode().canonicalExample));
    expect(good.ok).toBe(true);
  });
});
