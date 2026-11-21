// WHY: A word lesson must resolve its help the same way everywhere, and a card
// must find the form it is about without the pack repeating itself. This module
// is the one place that answers "which form is this card about?" and "what help
// does this card show?", so the study screen, the plan and a later export can
// never disagree.
// PACK: word-lessons
// 2026-11-21 opencode: created for the word-lessons pack. The resolver order is
// card teaching, then the word's note and the form's reason, then the card's
// Dictionary page. [pack: word-lessons]

import type { Card, CardPart, TeachingPart, Word, WordForm, WordStage } from "@/lib/shared/types";
import { WORD_STAGES } from "@/lib/core/schema";

/** The card fields the word resolver needs. A full card satisfies this. */
export type CardForWord = Pick<Card, "prompt" | "answer" | "answerDef" | "stage" | "wordId">;

/** The word a card names, or null when the pack has no such word. */
export function wordById(
  words: readonly Word[] | null | undefined,
  id: string | undefined,
): Word | null {
  if (!id || !words) return null;
  return words.find((word) => word.id === id) ?? null;
}

/** The text a card side carries, in order. Media and blanks contribute nothing. */
function sideText(parts: readonly CardPart[]): string {
  return parts
    .filter((part): part is Extract<CardPart, { type: "text" | "code" | "speak" }> =>
      part.type === "text" || part.type === "code" || part.type === "speak",
    )
    .map((part) => part.text)
    .join(" ");
}

/** Every answer the pack says is correct, from all three answer shapes. */
function expectedAnswers(card: CardForWord): string[] {
  const def = card.answerDef;
  return [
    ...(def.expected ?? []),
    ...(def.blanks ?? []).flatMap((blank) => blank.expected),
    ...(def.correct ?? []),
  ];
}

/**
 * The form this card is about, or null when the card does not name one.
 *
 * WHY longest first: a changed form can contain the lemma ("dom" inside
 * "domu"), so the most specific form must win. A card with one form and no
 * matching text still gets that form, because there is nothing to confuse it
 * with. A word with several forms and no match gets nothing rather than a
 * guess.
 */
export function formForCard(word: Word, card: CardForWord): WordForm | null {
  if (word.forms.length === 0) return null;
  const answers = [...expectedAnswers(card), sideText(card.answer), sideText(card.prompt)];
  const ordered = [...word.forms].sort((left, right) => right.to.length - left.to.length);
  const found = ordered.find((form) => answers.some((answer) => answer.includes(form.to)));
  if (found) return found;
  return word.forms.length === 1 ? word.forms[0] : null;
}

/** The pre-answer help for one card, in one fixed order. */
export interface CardHelpInput {
  card: CardForWord & Pick<Card, "teaching">;
  word?: Word | null;
  /** The card's Dictionary page parts, already read. */
  pageParts?: readonly TeachingPart[];
}

/**
 * The help a card shows before the answer, in the only order this app allows:
 * the pack's own teaching, then the word's note and the form's reason, then the
 * card's Dictionary page. The first source with content wins; an empty source
 * never hides a fuller one behind it.
 */
export function resolveCardHelp(input: CardHelpInput): TeachingPart[] {
  const own = input.card.teaching;
  if (own && own.length > 0) return own;

  if (input.word) {
    const form = formForCard(input.word, input.card);
    const fromWord = [...(input.word.note ?? []), ...(form?.why ?? [])];
    if (fromWord.length > 0) return fromWord;
  }

  // WHY: a plain card's layer is its own teaching, never its page. The page is a
  // separate place the learner opens on purpose, and showing its whole body as
  // pre-answer help would change every pack that already has one. Only a word
  // lesson, which has no other source, borrows its card page as a last fallback.
  if (!input.card.wordId) return [];
  return input.pageParts ? [...input.pageParts] : [];
}

/** Where a stage sits in the walk. An unknown stage sorts last, never first. */
export function stageRank(stage: WordStage | undefined): number {
  if (!stage) return WORD_STAGES.length;
  const index = WORD_STAGES.indexOf(stage);
  return index === -1 ? WORD_STAGES.length : index;
}
