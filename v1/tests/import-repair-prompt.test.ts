// WHY: The repair send is explicit, so the preview must carry the refused text
// and the exact validator refusal. The prompt must ask for corrected JSON only.
// PACK: import-repair
// 2026-10-27 opencode: created for the import repair pack
// [pack: import-repair]

import { describe, expect, it } from "vitest";
import { buildImportRepairPrompt, IMPORT_REPAIR_SYSTEM } from "@/lib/provider/repair";

const broken = '{"cards":[{"summary":"Nowa karta"}';

describe("the import repair prompt", () => {
  it("shows the refused text, every refusal line and the target shape", () => {
    const prompt = buildImportRepairPrompt(
      broken,
      ["cards.0.prompt: every card needs a prompt", "cards.0.answerDef: choose an answer rule"],
      "cards",
    );
    expect(prompt.display).toContain(broken);
    expect(prompt.display).toContain("cards.0.prompt: every card needs a prompt");
    expect(prompt.display).toContain("cards.0.answerDef: choose an answer rule");
    expect(prompt.display).toContain("Return one cards fragment with cards.");
    expect(prompt.display).toContain("Return only the corrected JSON.");
    expect(prompt.messages[0]).toEqual({ role: "system", content: IMPORT_REPAIR_SYSTEM });
    expect(prompt.messages[1]).toEqual({ role: "user", content: prompt.display });
    expect(prompt.display).not.toContain("```");
  });

  it("gives the pack and deck shapes their own one-line target", () => {
    expect(buildImportRepairPrompt(broken, [], "pack").display).toContain(
      "Return one whole pack object with pack, decks and cards.",
    );
    expect(buildImportRepairPrompt(broken, [], "deck").display).toContain(
      "Return one deck fragment with decks and cards.",
    );
  });

  it("says the validator refused the file when no detail survived", () => {
    const prompt = buildImportRepairPrompt(broken, [], "cards");
    expect(prompt.display).toContain("The file did not pass the normal import validator.");
  });
});
