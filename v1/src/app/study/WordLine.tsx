// WHY: A word card must say which word it belongs to without giving the answer
// away. Before the answer the line shows only the base word and its meaning;
// the changed form appears in the help, or beside the lemma once the answer is
// known. The changed form is never printed before the learner has tried.
// PACK: word-lessons
// 2026-11-21 opencode: created for the word-lessons pack. [pack: word-lessons]

import type { Card, Word } from "@/lib/shared/types";
import { formForCard } from "@/lib/core/word";

interface WordLineProps {
  word: Word;
  card: Card;
  /** True once the answer is on screen, so the form may be confirmed. */
  revealed: boolean;
}

/** The compact "which word is this" line above a word card. */
export default function WordLine({ word, card, revealed }: WordLineProps) {
  const form = formForCard(word, card);

  return (
    <div className="word-line">
      <span className="word-line-lemma">{word.lemma}</span>
      <span className="word-line-meaning">{word.meaning}</span>
      {revealed && form ? (
        <>
          <span className="word-line-arrow" aria-hidden="true">
            →
          </span>
          <span className="word-line-form">{form.to}</span>
          <span className="word-line-label">{form.label}</span>
          <span className="word-line-meaning">{form.meaning}</span>
        </>
      ) : null}
    </div>
  );
}
