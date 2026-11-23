// WHY: Mode Studio's decisions are the same on every screen: what a selected
// mode prefills, what a local preview shows, what may be deleted and what an
// export carries. Keeping them pure lets the node-only test suite prove them.
// PACK: mode-studio-ui
// 2026-11-23 opencode: created for the Track 4 helper seam. [pack: mode-studio-ui]

import { errorLines } from "@/app/library/library-utils";
import type { CreateTarget } from "@/app/library/library-utils";
import type { CreationBrief } from "@/lib/shared/creation";
import type { AnswerMode, CardPart, LearningMode } from "@/lib/shared/types";

/** One card a local preview can render without touching a route or a store. */
export interface PreviewCard {
  prompt: CardPart[];
  answer: CardPart[];
  revealAnswers: Record<string, string>;
}

/** The bundle shape a canonicalExample holds. Validated by Track 1 already. */
interface ExampleBundle {
  cards?: Array<{
    prompt: CardPart[];
    answer: CardPart[];
    answerDef?: {
      mode: AnswerMode;
      blanks?: Array<{ id: string; expected?: string[] }>;
    };
  }>;
}

/**
 * Copy a mode's card kinds into brief state.
 * WHY: D-53 records that cardMix is stored, not rendered; the copy must not
 * mutate the authored mode or pretend to change prompt wording.
 */
export function cardMixForMode(mode: LearningMode | null | undefined): AnswerMode[] {
  return mode ? [...(mode.defaultCardMix ?? [])] : [];
}

/**
 * Drop hidden mode fields when the learner changes target.
 * WHY: a stale modeId would reach a prompt silently, since D-52 resolves it
 * without complaining about a broken selection.
 */
export function briefWithoutMode(brief: CreationBrief): CreationBrief {
  const cleared = { ...brief };
  delete cleared.modeId;
  delete cleared.cardMix;
  delete cleared.modePreferences;
  return cleared;
}

/**
 * The read-only mode note for a target.
 * WHY: PackStatus has no mode field, so claiming an inherited mode would lie.
 */
export function inheritedModeNotice(target: CreateTarget): string | null {
  return target === "pack" ? null : "No learning mode is stored on this pack.";
}

/**
 * Map a canonical example to card parts and revealed blank answers.
 * WHY: Test Preview must be local and write nothing; this is the only work it
 * does before handing parts to CardSide.
 */
export function previewCardsFromExample(mode: LearningMode): PreviewCard[] {
  const example = mode.canonicalExample as ExampleBundle;
  return (example?.cards ?? []).map((card) => {
    const revealAnswers: Record<string, string> = {};
    for (const blank of card.answerDef?.blanks ?? []) {
      // WHY: the first expected answer is the one the reveal shows, matching
      // the study screen's own reveal map.
      if (blank.expected?.[0]) revealAnswers[blank.id] = blank.expected[0];
    }
    return { prompt: card.prompt, answer: card.answer, revealAnswers };
  });
}

/**
 * Render API validation detail as field-named lines.
 * WHY: an editor must say which field to fix, not just that a save failed.
 */
export function modeIssueLines(error: unknown): string[] {
  return errorLines(error);
}

/**
 * Export only learner-owned modes.
 * WHY: built-ins are installed from the app manifest and are never backed up.
 */
export function modeExportText(modes: LearningMode[]): string {
  const custom = modes
    .filter((mode) => !mode.isBuiltIn)
    .map((mode) => ({ ...mode, isBuiltIn: false }));
  return JSON.stringify({ modes: custom }, null, 2);
}

/**
 * Strictly parse one imported mode file.
 * WHY: the router forces isBuiltIn and validates on create, so this helper
 * only hands over the parsed body; it never silently repairs JSON.
 */
export function modeImportBody(text: string): { modes: LearningMode[] } {
  const parsed = JSON.parse(text) as { modes?: unknown };
  // WHY: a wrongly shaped file must name its problem, not throw a later
  // "not iterable" error while the screen is already importing.
  if (!Array.isArray(parsed?.modes)) throw new Error("This file has no list of learning modes.");
  return parsed as { modes: LearningMode[] };
}

/** Where a mode Save goes: create for an unsaved draft, edit for a stored row. */
export function modeSaveRequest(
  mode: LearningMode,
  isNew: boolean,
): { method: "POST" | "PATCH"; url: string; body: LearningMode } {
  // WHY: a drafted mode has no row, so PATCH would always refuse it. Keeping
  // the choice here makes the editor's only write path testable without React.
  return isNew
    ? { method: "POST", url: "/api/modes", body: mode }
    : { method: "PATCH", url: `/api/modes/${encodeURIComponent(mode.id)}`, body: mode };
}

/** Only a learner-owned mode may be deleted; built-ins are app-owned. */
export function canDeleteMode(mode: LearningMode): boolean {
  return !mode.isBuiltIn;
}

/** The exact visible name a typed-name delete confirmation must match. */
export function modeDeleteName(mode: LearningMode): string {
  return mode.name;
}
