// WHY: A word lesson is only worth teaching if it is whole. A card that names a
// word nobody defined, or a matching card with one pair, is not a small typo:
// it renders as a broken or empty exercise the learner cannot answer. This
// module is the one place that checks the links between words and cards, and it
// speaks in sentences a person can act on.
// PACK: word-lessons
// 2026-11-21 opencode: created for the word-lessons pack. Called by the bundle
// import, the folder loader and the flat import, so all three lanes refuse the
// same lesson for the same reason. [pack: word-lessons]

import type { CardSource, Word } from "@/lib/shared/types";
import { STAGE_MODE, type ValidationIssue } from "@/lib/core/schema";

/** The card fields a lesson check needs. Both a source and a bundle card have them. */
export type LessonCard = Pick<CardSource, "summary" | "wordId" | "stage" | "answerDef">;

/** Name one card the way a person reads it. */
function cardName(card: LessonCard, index: number): string {
  const summary = card.summary.trim();
  return summary.length > 0 ? `Card ${index + 1} ("${summary}")` : `Card ${index + 1}`;
}

/** Name one word the way a person wrote it. */
function wordName(word: Word): string {
  return `word "${word.id}"`;
}

/**
 * Every problem with a pack's word lessons, in card order then word order.
 *
 * `existingWords` is for a fragment that adds cards to a pack that already has
 * words: a link may point at one of those, and a duplicate check must not look
 * at them because the fragment does not define them.
 */
export function lessonIssues(
  cards: readonly LessonCard[],
  words: readonly Word[],
  existingWords: readonly Word[] = [],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // The words this file defines. A repeat is a real ambiguity: which one does a
  // card link to?
  const seenIds = new Set<string>();
  words.forEach((word, index) => {
    if (seenIds.has(word.id)) {
      issues.push({
        index,
        field: `words.${index}.id`,
        message: `Word "${word.id}" appears twice in this pack; a word id must be unique.`,
      });
    }
    seenIds.add(word.id);

    const targets = new Set<string>();
    const meanings = new Set<string>();
    for (const pair of word.pairs) {
      const target = pair.target.trim();
      const meaning = pair.meaning.trim();
      if (targets.has(target)) {
        issues.push({
          index,
          field: `words.${index}.pairs`,
          message: `Word "${word.id}": two matching pairs share the target "${target}".`,
        });
      }
      if (meanings.has(meaning)) {
        issues.push({
          index,
          field: `words.${index}.pairs`,
          message: `Word "${word.id}": two matching pairs share the meaning "${meaning}".`,
        });
      }
      targets.add(target);
      meanings.add(meaning);
    }
  });

  // A fragment may link to a word the target pack already has.
  const known = new Map<string, Word>();
  for (const word of existingWords) known.set(word.id, word);
  for (const word of words) known.set(word.id, word);

  cards.forEach((card, index) => {
    const name = cardName(card, index);
    const hasWord = typeof card.wordId === "string" && card.wordId.length > 0;
    const hasStage = card.stage !== undefined;

    // The link is a pair: a word without a stage has no place in the walk, and a
    // stage without a word has nothing to teach.
    if (hasWord && !hasStage) {
      issues.push({
        index,
        field: `cards.${index}.stage`,
        message: `${name}: a word link needs a stage.`,
      });
    }
    if (hasStage && !hasWord) {
      issues.push({
        index,
        field: `cards.${index}.wordId`,
        message: `${name}: a stage needs a word.`,
      });
    }

    const mode = card.answerDef.mode;
    if (!hasWord) {
      if (mode === "match") {
        issues.push({
          index,
          field: `cards.${index}.wordId`,
          message: `${name}: a matching card needs a word to take its pairs from.`,
        });
      }
      return;
    }

    const word = known.get(card.wordId as string);
    if (!word) {
      issues.push({
        index,
        field: `cards.${index}.wordId`,
        message: `${name}: names the word "${card.wordId}", which this pack does not define.`,
      });
      return;
    }

    if (!hasStage) return;
    const wanted = STAGE_MODE[card.stage as keyof typeof STAGE_MODE];
    if (mode !== wanted) {
      issues.push({
        index,
        field: `cards.${index}.stage`,
        message: `${name}: stage "${card.stage}" needs a ${wanted} card, not ${mode}.`,
      });
    }

    if (card.stage === "forms" && word.forms.length === 0) {
      issues.push({
        index,
        field: `cards.${index}.stage`,
        message: `${name}: stage "forms" needs at least one form on ${wordName(word)}.`,
      });
    }

    if (card.stage === "matching" && word.pairs.length < 2) {
      issues.push({
        index,
        field: `cards.${index}.stage`,
        message: `${name}: stage "matching" needs at least two pairs on ${wordName(word)}.`,
      });
    }
  });

  return issues;
}

/**
 * The same check, reduced to one plain sentence for a lane that can only show
 * one problem. Null means the lesson is whole.
 */
export function firstLessonProblem(
  cards: readonly LessonCard[],
  words: readonly Word[],
  existingWords: readonly Word[] = [],
): string | null {
  const [first] = lessonIssues(cards, words, existingWords);
  return first ? first.message : null;
}
