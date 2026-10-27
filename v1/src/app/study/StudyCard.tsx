// WHY: The card is the one thing the learner looks at. The question, the
// reveal and the corrections all live in this module so the session shell can
// stay about position and escape, and so the teaching layer has one card to
// sit above rather than a second copy of the screen.
// PACK: study-tab-redesign
// 2026-10-25 opencode: moved the question and reveal out of StudyClient and
// applied the approved card-as-hero design [pack: study-tab-redesign]
// 2026-10-25 opencode: the card names its judged outcome so the stylesheet can
// tint the reveal without changing any rule. [pack: learner-delight]
// 2026-10-27 opencode: the answer can be heard in the pack language, and a code
// answer is explained instead of read as symbols. [pack: answer-speech]

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { answerSpeech } from "@/lib/client/answer-speech";
import { speak, speakLines, speechSupported } from "@/lib/client/speech";
import { LISTEN_INSTRUCTION, listenPrompt, studyModeLabel } from "@/lib/client/study-view";
import { OUTCOME_LABELS, OUTCOME_MEANINGS } from "@/lib/core/outcome";
import type { AnswerResult, Card, CardPart, Outcome } from "@/lib/shared/types";
import CardSide from "./CardSide";

interface StudyCardProps {
  card: Card;
  answers: Record<string, string>;
  onAnswerChange: (next: Record<string, string>) => void;
  working: string;
  onWorkingChange: (value: string) => void;
  result?: AnswerResult;
  hintTexts: string[];
  hintMessage: string | null;
  hintSource: string | null;
  hintBusy: boolean;
  busy: boolean;
  returned: boolean;
  /** A cold return shows what it is and expects no teaching layer. */
  coldCheck?: boolean;
  /** The folded layer bar, owned by the session. */
  layerBar?: ReactNode;
  /** The pack's learning language, used by the answer voice. */
  answerLang?: string;
  /** The pack's question language, used for a translation line. */
  answerSourceLang?: string;
  instruction: string;
  isLast: boolean;
  onHint: () => void;
  onSubmit: () => void;
  onNext: () => void;
  onCorrect: (region: string | null, outcome: Outcome) => void;
}

/** The question, the hint block and the answer reveal. */
export default function StudyCard({
  card,
  answers,
  onAnswerChange,
  working,
  onWorkingChange,
  result,
  hintTexts,
  hintMessage,
  hintSource,
  hintBusy,
  busy,
  returned,
  coldCheck,
  layerBar,
  answerLang,
  answerSourceLang,
  instruction,
  isLast,
  onHint,
  onSubmit,
  onNext,
  onCorrect,
}: StudyCardProps) {
  const mode = card.answerDef.mode;
  // WHY: Each line keeps its own language, so a Polish answer and its English
  // translation are not read with one voice.
  const spoken = answerSpeech(card.answer, {
    lang: answerLang,
    sourceLang: answerSourceLang,
    teaching: card.teaching,
  });
  const [speechReady, setSpeechReady] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setSpeechReady(speechSupported());
    });
    return () => {
      active = false;
    };
  }, []);
  const canSubmit = mode !== "picks" || (answers.choice ?? "").length > 0;
  const listen = mode === "hear_type" ? listenPrompt(card) : null;
  const blanks = card.prompt.filter(
    (part): part is Extract<CardPart, { type: "blank" }> => part.type === "blank",
  );
  const regionLabel = (region: string | null) =>
    region === null ? "The answer" : `Blank ${blanks.findIndex((part) => part.id === region) + 1}`;

  // WHY: The reveal puts the expected word back in the line. The rows carry
  // what each region expected, so the prompt can show the correction in place
  // without re-judging anything.
  const revealAnswers = result
    ? Object.fromEntries(
        result.results
          .filter((row): row is typeof row & { region: string } => row.region !== null)
          .map((row) => [row.region, row.expected[0] ?? ""]),
      )
    : undefined;

  const hintBlock =
    hintTexts.length > 0 ? (
      <div className="notice study-hint">
        <p className="study-hint-label">
          {hintSource === "tutor" ? "Tutor hint" : hintSource === "pack" ? "Pack hint" : "Hint"}
        </p>
        {hintTexts.map((text, position) => (
          <p key={position} className="study-hint-text">
            {text}
          </p>
        ))}
        {hintMessage ? <p className="muted study-hint-message">{hintMessage}</p> : null}
      </div>
    ) : hintMessage ? (
      <div className="notice">{hintMessage}</div>
    ) : null;

  return (
    <div
      className="study-card"
      data-outcome={result?.cardOutcome}
      onKeyDown={(event) => {
        // WHY: The simulation promises Enter to check. Only a text input
        // triggers it, so Enter still adds a line inside the working box.
        if (result || busy || !canSubmit) return;
        if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="study-card-top">
        <span className="study-mode">{studyModeLabel(mode)}</span>
        {result ? (
          <span className={`outcome outcome-${result.cardOutcome} study-outcome`}>
            {OUTCOME_LABELS[result.cardOutcome]}
          </span>
        ) : (
          <button className="study-link" type="button" onClick={onHint} disabled={hintBusy}>
            {hintBusy ? "Asking…" : hintTexts.length > 0 ? "Ask for another hint" : "Ask for a hint"}
          </button>
        )}
      </div>

      {returned ? (
        <p className="muted study-returned">
          This one is marked to return once — it was missed in this session.
        </p>
      ) : null}

      {coldCheck ? (
        <div className="cold-note">
          <strong>Cold check.</strong> The same card, without its teaching layer. One return per
          card per session.
        </div>
      ) : null}

      {layerBar}

      {result && mode !== "hear_type" ? (
        <div className="study-prompt study-prompt-reveal">
          <CardSide parts={card.prompt} revealAnswers={revealAnswers} />
        </div>
      ) : null}

      {!result ? (
        <>
          {mode === "hear_type" && listen ? (
            <div className="study-listen">
              <button
                className="btn study-play"
                type="button"
                onClick={() => speak(listen.text, listen.lang)}
              >
                Play the line
              </button>
              <p className="muted">{LISTEN_INSTRUCTION}</p>
            </div>
          ) : (
            <div className="study-prompt">
              <CardSide
                parts={card.prompt}
                answers={answers}
                onAnswer={(id, value) => onAnswerChange({ ...answers, [id]: value })}
                interactive
              />
            </div>
          )}
          <p className="muted study-instruction">{instruction}</p>
        </>
      ) : null}

      {hintBlock}

      {!result ? (
        <>
          {mode === "picks" ? (
            <div className="options">
              {(card.answerDef.options ?? []).map((option) => (
                <button
                  key={option}
                  type="button"
                  className="option"
                  aria-pressed={answers.choice === option}
                  onClick={() => onAnswerChange({ choice: option })}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : mode === "cloze" ? null : (
            <input
              className="answer-input"
              placeholder={mode === "hear_type" ? "Type what you hear" : "Your answer"}
              value={answers.answer ?? ""}
              onChange={(event) => onAnswerChange({ answer: event.target.value })}
            />
          )}
          {card.answerDef.working ? (
            <textarea
              className="answer-input"
              placeholder={`${card.answerDef.working.label} (shown on screen, then discarded — nothing is sent)`}
              value={working}
              onChange={(event) => onWorkingChange(event.target.value)}
            />
          ) : null}
          <div className="study-card-actions">
            {mode !== "picks" ? (
              <span className="study-enter">
                <kbd>Enter</kbd> to check
              </span>
            ) : (
              <span className="study-enter" />
            )}
            <button
              className="btn primary"
              type="button"
              onClick={onSubmit}
              disabled={busy || !canSubmit}
            >
              {busy ? "Checking…" : "Answer"}
            </button>
          </div>
        </>
      ) : (
        <div className="study-result">
          <div className="study-answer">
            <CardSide parts={card.answer} />
          </div>

          {speechReady && spoken.length > 0 ? (
            <button
              className="btn small study-hear"
              type="button"
              onClick={() => speakLines(spoken)}
            >
              Hear the answer
            </button>
          ) : null}

          {result.capped ? <p className="muted study-capped">A hint capped this at Nearly.</p> : null}

          {card.answerDef.working ? (
            <div className="notice study-working">
              <div className="study-working-grid">
                <div>
                  <p className="muted">Your working</p>
                  <p>{working.trim().length > 0 ? working : "(nothing written)"}</p>
                </div>
                <div>
                  <p className="muted">{card.answerDef.working.label}</p>
                  <p>{card.answerDef.working.expected}</p>
                </div>
              </div>
              <p className="muted study-working-note">
                Side by side for a moment. Nothing here was saved or sent.
              </p>
            </div>
          ) : null}

          {result.results.map((region, position) => (
            <p className="study-region-line" key={`${region.region ?? "whole"}-${position}`}>
              {result.results.length > 1 ? (
                <span className="study-region-label">{regionLabel(region.region)}: </span>
              ) : null}
              You wrote “{region.given || "(nothing)"}”; expected “{region.expected.join(" / ")}”.
            </p>
          ))}

          <details className="study-fair">
            <summary>Was this fair?</summary>
            <p className="study-fair-note">
              Keep the outcome, or correct the app if it judged you unfairly.
            </p>
            {result.results.map((region, position) => (
              <div className="study-fair-row" key={`${region.region ?? "whole"}-${position}`}>
                {result.results.length > 1 ? (
                  <span className="study-fair-label">{regionLabel(region.region)}</span>
                ) : null}
                <button
                  className="btn small"
                  type="button"
                  title={OUTCOME_MEANINGS.got_it}
                  onClick={() => onCorrect(region.region, "got_it")}
                >
                  I got it
                </button>
                <button
                  className="btn small"
                  type="button"
                  title={OUTCOME_MEANINGS.nearly}
                  onClick={() => onCorrect(region.region, "nearly")}
                >
                  Nearly
                </button>
                <button
                  className="btn small"
                  type="button"
                  title={OUTCOME_MEANINGS.again}
                  onClick={() => onCorrect(region.region, "again")}
                >
                  I missed it
                </button>
                <button
                  className="btn small"
                  type="button"
                  title={OUTCOME_MEANINGS.no}
                  onClick={() => onCorrect(region.region, "no")}
                >
                  No
                </button>
              </div>
            ))}
          </details>

          <div className="study-card-actions">
            <Link
              className="study-link"
              href={`/library?card=${encodeURIComponent(card.id)}`}
              prefetch={false}
            >
              Look at this card&apos;s record
            </Link>
            <button className="btn primary" type="button" onClick={onNext} disabled={busy}>
              {isLast ? "Finish" : "Next card"} <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
