// WHY: The prompt layers are the one place the two lanes share their words.
// These tests read the public seam, not the lane internals: the layers must be
// pure, the universal rules must appear once, and a mode may change only the
// third layer. They are written before the module exists. [pack: prompt-assembler]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assemblePrompt,
  layerOneSystemAndContract,
  modeSection,
  OUTPUT_CONTRACT_LINE,
  PROMPT_SKILL_VERSION,
  promptInputsFromBrief,
  SELF_CONTAINED_RULE,
  TEACHING_RULE_LINES,
  universalCardRules,
  type ModePromptContribution,
} from "@/lib/shared/prompt-layers";
import { defaultCreationBrief, libraryInventoryFromPacks } from "@/lib/shared/creation";

const modulePath = fileURLToPath(
  new URL("../src/lib/shared/prompt-layers.ts", import.meta.url),
);

const modeA: ModePromptContribution = {
  skillInstructions: "MODE-A-SKILL: one deck per role.",
  canonicalExample: '{"pack":{"name":"example-a"}}',
};

const modeB: ModePromptContribution = {
  skillInstructions: "MODE-B-SKILL: one card per form.",
  canonicalExample: '{"pack":{"name":"example-b"}}',
};

function shape(): string {
  return '{"lines":[{"style":"cloze"}]}';
}

function built(mode?: ModePromptContribution) {
  return assemblePrompt({
    system: layerOneSystemAndContract("pack"),
    lines: universalCardRules({}),
    mode,
    shape: shape(),
  });
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("shared prompt layers", () => {
  it("owns one version and one output-contract line", () => {
    expect(PROMPT_SKILL_VERSION).toBe("9.0.0");
    expect(OUTPUT_CONTRACT_LINE).toBe("Return JSON only, shaped like:");
  });

  it("keeps layer 1 to the system text and the contract", () => {
    for (const target of ["lines", "pack", "deck"] as const) {
      const layer = layerOneSystemAndContract(target);
      expect(layer).toContain("You write complete, correct study lines");
      expect(layer).toContain(OUTPUT_CONTRACT_LINE);
      expect(layer).not.toContain("MODE-A-SKILL");
      expect(layer).not.toContain("MODE-B-SKILL");
      expect(layer).not.toContain("canonical example");
    }
  });

  it("keeps every universal rule free of mode text", () => {
    const rules = universalCardRules({}).join("\n");
    expect(rules).toContain("Base word: cup.");
    expect(rules).toContain("Owner: Anna.");
    for (const rule of TEACHING_RULE_LINES) expect(rules).toContain(rule);
    expect(rules).not.toContain("MODE-A-SKILL");
    expect(rules).not.toContain("canonical example");
    expect(SELF_CONTAINED_RULE).toBe(rules.split("\n")[0]);
  });

  it("assembles in the order universal, mode, contract, shape", () => {
    const text = built(modeA).display;
    const universalAt = text.indexOf(SELF_CONTAINED_RULE);
    const modeAt = text.indexOf(modeA.skillInstructions);
    const contractAt = text.lastIndexOf(OUTPUT_CONTRACT_LINE);
    const shapeAt = text.lastIndexOf(shape());
    expect(universalAt).toBeGreaterThanOrEqual(0);
    expect(modeAt).toBeGreaterThan(universalAt);
    expect(contractAt).toBeGreaterThan(modeAt);
    expect(shapeAt).toBeGreaterThan(contractAt);
  });

  it("puts every universal rule in the prompt exactly once", () => {
    const text = built(modeA).display;
    for (const rule of universalCardRules({})) expect(count(text, rule)).toBe(1);
    expect(count(text, "may add \"teaching\"")).toBe(1);
  });

  it("renders a mode section exactly once and nothing when there is no mode", () => {
    const lines = modeSection(modeA).join("\n");
    expect(count(lines, modeA.skillInstructions)).toBe(1);
    expect(count(lines, modeA.canonicalExample)).toBe(1);
    expect(modeSection(null)).toEqual([]);
    expect(modeSection({ skillInstructions: "   ", canonicalExample: "x" })).toEqual([]);
    expect(built().display).not.toContain("Learning mode:");
  });

  it("changes only layer 3 when the mode changes", () => {
    const first = built(modeA).display;
    const second = built(modeB).display;
    expect(first).not.toBe(second);
    const firstMode = modeSection(modeA).join("\n");
    const secondMode = modeSection(modeB).join("\n");
    expect(first.replace(firstMode, "MODE")).toBe(second.replace(secondMode, "MODE"));
  });

  it("is browser safe: no node import and no mode entity in the shared module", () => {
    const source = readFileSync(modulePath, "utf8");
    expect(source).not.toMatch(/from\s+["']node:/);
    expect(source).not.toMatch(/from\s+["']@lib\/node/);
    expect(source).not.toContain("LearningMode");
  });

  it("maps a brief and a profile into prompt inputs without changing the brief", () => {
    const brief = defaultCreationBrief({
      subject: "ordering coffee",
      targetLanguage: "es",
      sourceLanguage: "en",
      studyInstruction: "Say each line aloud.",
      cardMix: ["cloze", "type"],
    });
    const before = JSON.stringify(brief);
    const inputs = promptInputsFromBrief(
      brief,
      libraryInventoryFromPacks([{ name: "starter", decks: [{ name: "Basics" }] }]),
      { weakTopics: [], level: "beginner", learningStyle: "examples-first" },
      4,
    );
    expect(inputs).toMatchObject({
      subject: "ordering coffee",
      targetLanguage: "es",
      questionLanguage: "en",
      existingLibrarySummary: expect.stringContaining("starter"),
      customFocus: "Say each line aloud.",
      cardMix: ["cloze", "type"],
      level: "beginner",
      learningStyle: "examples-first",
      count: 4,
    });
    expect(JSON.stringify(brief)).toBe(before);
  });
});
