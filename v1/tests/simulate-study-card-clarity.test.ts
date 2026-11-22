// WHY: This is the post-implementation rehearsal for study-card-clarity. It
// reads the real helpers, the real stylesheet and the built Study and Library
// output, so it fails when the plain card, the moved note or the prompt rules
// drift from the locked design. The pre-impl script showed the design; this one
// reads what shipped.
// PACK: study-card-clarity
// 2026-11-22 opencode: created for the study-card-clarity pack. [pack: study-card-clarity]

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AUTHORING_SKILL_VERSION, buildAuthoringPrompt } from "@/lib/browser/authoring";
import { studyCardInstruction } from "@/lib/client/study-view";
import { clozeContextIssue } from "@/lib/core/prompt-context";
import { generatedPackBundle } from "@/lib/provider/generate";
import { defaultCreationBrief } from "@/lib/shared/creation";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const out = join(projectRoot, "out");
const cssPath = join(projectRoot, "src", "app", "globals.css");

function line(message: string): void {
  console.log(`-> ${message}`);
}

/** The built app is one tree of static files; read the text-bearing ones. */
async function readTree(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  const parts = await Promise.all(
    entries.map(async (entry) => {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) return readTree(full);
      if (!/\.(js|html|css)$/.test(entry.name)) return "";
      return readFile(full, "utf8");
    }),
  );
  return parts.join("\n");
}

/** One CSS block, so a rule in a different selector cannot satisfy a scene. */
function block(css: string, selector: string): string {
  const at = css.indexOf(selector);
  if (at < 0) return "";
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  return css.slice(open, close + 1);
}

/** The example JSON the authoring prompt teaches, without importing test helpers. */
function exampleShape(prompt: string): string {
  const at = prompt.lastIndexOf('"pack": {');
  return at < 0 ? "" : prompt.slice(at);
}

describe("study card clarity rehearsal", () => {
  it("walks every PRD promise through real helpers and the built app", async () => {
    const rawRequest =
      "your job is use other words other than the Latin jargons and explain every form";
    const oldPack = {
      language: "pl",
      sourceLanguage: "en",
      studyInstruction: rawRequest,
    };

    const instruction = studyCardInstruction({ answerDef: { mode: "cloze" } }, oldPack);
    expect(instruction).toBe("Fill the blank in the Polish line.");
    expect(instruction).not.toContain(rawRequest);
    line("scene 1: the card prints only the automatic mode line, not the pack's raw request");

    expect(existsSync(join(out, "index.html")), "run npm run build first").toBe(true);
    const built = await readTree(out);
    expect(built).toContain("Study goal:");
    expect(built).toContain("pack-study-goal");
    expect(built).not.toContain(rawRequest);
    line("scene 2: the built pack overview carries the Study goal label and class");

    const css = await readFile(cssPath, "utf8");
    expect(block(css, ".study-card[data-outcome] {")).toContain("--wash: transparent");
    expect(css).not.toContain('.study-card[data-outcome="got_it"]');
    expect(block(css, ".study-outcome {")).toContain("background: transparent");
    expect(block(css, ".study-answer {")).toContain("border-left: 3px solid var(--line)");
    expect(css).not.toContain('.study-card[data-outcome="got_it"] .study-answer');
    expect(block(css, ".study-hint {")).toContain("background: var(--soft)");
    expect(block(css, ".layer-bar {")).toContain("border-left: 3px solid var(--line)");
    expect(block(css, ".word-line-form {")).toContain("color: var(--ink)");
    line("scene 3: no outcome wash, coloured border, answer rule or tinted blocks remain");

    const primary = block(css, ".study-card .btn.primary {");
    expect(primary).toContain("background: var(--ink)");
    expect(primary).toContain("color: var(--card)");
    expect(primary).toContain("box-shadow: none");
    expect(block(css, ':root {')).toMatch(/--ink:\s*#/);
    expect(block(css, ':root[data-theme="dark"] {')).toMatch(/--ink:\s*#/);
    expect(block(css, ':root[data-theme="dark"] {')).not.toContain("--ink: #23211d");
    line("scene 4: the card's primary action is ink on paper in both themes");

    expect(AUTHORING_SKILL_VERSION).toBe("8.0.0");
    const authoring = buildAuthoringPrompt({ kind: "pack" });
    expect(authoring).toContain("Base word: cup. There are two ___ on the table.");
    expect(authoring).toContain("Owner: Anna. That is ___ winter coat.");
    line("scene 5: the authoring skill is 8.0.0 and carries both self-contained examples");

    const coatIssue = clozeContextIssue({
      prompt: [{ type: "text", text: "That is ___ winter coat." }],
      answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["Anna's"] }] },
    });
    expect(coatIssue?.message).toContain("Owner: Anna.");
    line("scene 6: the possessive card is refused and names its owner");

    const cupsIssue = clozeContextIssue({
      prompt: [{ type: "text", text: "There are two ___ on the table." }],
      answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["cups"] }] },
    });
    expect(cupsIssue?.message).toContain("Base word: cup.");
    line("scene 7: the counted plural is refused and names its base word");

    for (const prompt of [
      "Owner: Anna. That is ___ winter coat.",
      "Base word: cup. There are two ___ on the table.",
    ]) {
      expect(
        clozeContextIssue({
          prompt: [{ type: "text", text: prompt }],
          answerDef: {
            mode: "cloze",
            blanks: [{ id: "b1", expected: [prompt.startsWith("Owner") ? "Anna's" : "cups"] }],
          },
        }),
      ).toBeNull();
    }
    line("scene 8: the self-contained versions of both cards pass");

    const authored = buildAuthoringPrompt(
      { kind: "pack" },
      null,
      { brief: defaultCreationBrief({ subject: "coffee", studyInstruction: rawRequest }) },
    );
    expect(exampleShape(authored)).not.toContain(rawRequest);
    expect(exampleShape(authored)).toContain(
      "<one short learner-facing sentence on how to study>",
    );
    line("scene 9: the authoring example shape no longer prints the raw study request");

    const generated = generatedPackBundle(
      JSON.stringify({
        pack: {
          name: "generated",
          studyInstruction: "Focus on plain-English word form changes without Latin grammar jargon.",
        },
        decks: [{ id: "basics", name: "Basics" }],
        lines: [{ deckId: "basics", fullLine: "The cat is black.", target: "black" }],
      }),
      { studyInstruction: rawRequest },
    );
    expect(generated.ok).toBe(true);
    if (generated.ok) {
      expect(generated.bundle.pack).toMatchObject({
        studyInstruction: "Focus on plain-English word form changes without Latin grammar jargon.",
      });
    }
    line("scene 10: a generated pack keeps the provider's distilled note over the raw brief");

    const noNote = studyCardInstruction(
      { answerDef: { mode: "type" } },
      { language: "pl", sourceLanguage: "en" },
    );
    expect(noNote).toBe("Read the English line, then type the full Polish line.");
    line("scene 11: an old pack with no note still loads and keeps the automatic mode line");

    console.log("PASS: study-card-clarity contract");
  });
});
