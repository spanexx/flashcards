// WHY: A deterministic import refusal cannot be fixed by pressing Try again.
// This prompt lets the learner's provider see the refused file and the exact
// refusal, and asks for corrected JSON only; the normal validator still decides
// whether anything is saved.
// PACK: import-repair
// 2026-10-27 opencode: created for the import repair pack
// [pack: import-repair]

import type { ChatMessage } from "@/lib/provider/client";
import type { BuiltPrompt } from "@/lib/provider/prompt";

/** The three import shapes the repair prompt can name. */
export type ImportRepairTarget = "pack" | "deck" | "cards";

/** The instruction that keeps the model inside the import format. */
export const IMPORT_REPAIR_SYSTEM =
  "You repair a flashcard import file. Return corrected JSON only, with no explanation and no markdown fence. Keep the same import target, keep the learner's content, and do not invent cards. The app will check your answer with the same strict validator that refused the file.";

/** The shape lines that keep a pack, deck and cards file from being confused. */
function targetLine(target: ImportRepairTarget): string {
  if (target === "pack") {
    return "Return one whole pack object with pack, decks and cards.";
  }
  if (target === "deck") {
    return "Return one deck fragment with decks and cards.";
  }
  return "Return one cards fragment with cards.";
}

/**
 * Build the exact preview text and the messages that will be sent. The refused
 * text and every validator line are shown verbatim, because the learner is the
 * one allowing this one import to leave the machine.
 */
export function buildImportRepairPrompt(
  text: string,
  details: readonly string[],
  target: ImportRepairTarget,
): BuiltPrompt {
  const refusal = details.length > 0
    ? details.map((line) => `- ${line}`).join("\n")
    : "- The file did not pass the normal import validator.";
  const user = [
    `Repair this flashcard import for a ${target} target.`,
    targetLine(target),
    "",
    "The exact text that was refused:",
    text,
    "",
    "The validator said:",
    refusal,
    "",
    "Return only the corrected JSON.",
  ].join("\n");
  const messages: ChatMessage[] = [
    { role: "system", content: IMPORT_REPAIR_SYSTEM },
    { role: "user", content: user },
  ];
  return { display: user, messages };
}
