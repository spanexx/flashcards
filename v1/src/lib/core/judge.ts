// WHY: Judging is a seam. The core hosts a local judge and never decides by
// itself, so every verdict in this file comes from a declared expectation and
// every missing expectation becomes unjudged rather than a guess.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import type { AnswerDef, Outcome } from "@/lib/shared/types";
import { isNearMatch, matchesAny, type NormalizeOptions } from "@/lib/core/normalize";
import { capForHint, worstOutcome, wrongOutcomeFor } from "@/lib/core/outcome";

/** One region's verdict, with the words the learner gave and expected. */
export interface JudgedRegion {
  region: string | null;
  outcome: Outcome;
  given: string;
  expected: string[];
  nearMiss: boolean;
}

/** The whole card's verdict and whether a hint capped it. */
export interface JudgedCard {
  results: JudgedRegion[];
  cardOutcome: Outcome;
  capped: boolean;
  judge: "local" | "learner";
}

/** Turn the declared judge style into comparison options. */
function optionsFor(answerDef: AnswerDef): NormalizeOptions {
  return {
    caseSensitive: answerDef.caseSensitive ?? false,
    exact: answerDef.judge === "exact",
  };
}

/**
 * Judge one region. An empty expectation list means no judge is available and
 * the row is unjudged, which is a state the record can tell apart from wrong.
 */
export function judgeRegion(
  given: string,
  expected: string[],
  options: NormalizeOptions,
  seenBefore: number,
): JudgedRegion {
  if (expected.length === 0) {
    return { region: null, outcome: "unjudged", given, expected, nearMiss: false };
  }
  if (matchesAny(given, expected, options)) {
    return { region: null, outcome: "got_it", given, expected, nearMiss: false };
  }
  if (isNearMatch(given, expected, options)) {
    return { region: null, outcome: "nearly", given, expected, nearMiss: true };
  }
  return { region: null, outcome: wrongOutcomeFor(seenBefore), given, expected, nearMiss: false };
}

/**
 * Judge every region a card asked for. A hint caps each Got it at Nearly, which
 * is the locked trade: a helped answer is not an unaided correct answer.
 */
export function judgeCard(
  answerDef: AnswerDef,
  answers: Record<string, string>,
  seenBefore: number,
  hintUsed: boolean,
): JudgedCard {
  const options = optionsFor(answerDef);
  let regions: JudgedRegion[] = [];

  if (answerDef.mode === "cloze") {
    regions = (answerDef.blanks ?? []).map((blank) => {
      const judged = judgeRegion(answers[blank.id] ?? "", blank.expected, options, seenBefore);
      return { ...judged, region: blank.id };
    });
  } else if (answerDef.mode === "picks") {
    regions = [
      {
        ...judgeRegion(answers.choice ?? "", answerDef.correct ?? [], options, seenBefore),
        region: null,
      },
    ];
  } else {
    regions = [
      {
        ...judgeRegion(answers.answer ?? "", answerDef.expected ?? [], options, seenBefore),
        region: null,
      },
    ];
  }

  let capped = false;
  if (hintUsed) {
    regions = regions.map((region) => {
      const cappedOutcome = capForHint(region.outcome);
      if (cappedOutcome !== region.outcome) capped = true;
      return { ...region, outcome: cappedOutcome };
    });
  }

  const judge = regions.some((region) => region.outcome === "unjudged") ? "learner" : "local";
  return {
    results: regions,
    cardOutcome: worstOutcome(regions.map((region) => region.outcome)),
    capped,
    judge,
  };
}
