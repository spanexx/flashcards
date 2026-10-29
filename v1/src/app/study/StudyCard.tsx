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
// 2026-10-27 opencode: Next says Enter continues, and the footer pins itself
// while the card scrolls; the session card reserves a minimum height.
// [pack: session-advance]
// 2026-10-28 opencode: the Answer button and Enter stay disabled until the card
// holds an attempt; a beginner can finish the expected answer inline, a quiet
// I-don't-know reveals on purpose, and accepting a completion has a soft cue
// and hands the caret back to the field. [pack: study-card-guidance]

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { answerSpeech } from "@/lib/client/answer-speech";
import { playCue } from "@/lib/client/sound";
import { answerCompletion } from "@/lib/core/answer-completion";
import { hasAnswerAttempt } from "@/lib/core/answer-attempt";
import { speak, speakLines, speechSupported } from "@/lib/client/speech";
import { LISTEN_INSTRUCTION, listenPrompt, studyModeLabel } from "@/lib/client/study-view";
import { OUTCOME_LABELS, OUTCOME_MEANINGS } from "@/lib/core/outcome";
import type { AnswerResult, Card, CardPart, Outcome, StudyLevel } from "@/lib/shared/types";
import CardSide from "./CardSide";

/** A hint bulb and a book mark; the words ride beside them on a wide screen. */
const BULB = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
  </svg>
);

const BOOK = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const CHECK = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m5 12 5 5 9-10" />
  </svg>
);

interface StudyCardProps {
  card: Card;
  /** The card's deck level; beginner is the only level that completes. */
  level: StudyLevel;
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
  /** The card page; the Dictionary button always opens it. */
  dictionaryHref: string;
  /** The pack asks for the page first; this only adds a chip and a warning. */
  askPageRead?: boolean;
  /** A written page exists for this card in this browser. */
  hasPage?: boolean;
  /** Every part of that page is traced in this browser. */
  pageRead?: boolean;
  /** Checks what is typed; a given map is sent instead (the I-don't-know path). */
  onSubmit: (answersOverride?: Record<string, string>) => void;
  onNext: () => void;
  onCorrect: (region: string | null, outcome: Outcome) => void;
}

/** The question, the hint block and the answer reveal. */
export default function StudyCard({
  card,
  level,
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
  dictionaryHref,
  askPageRead,
  hasPage,
  pageRead,
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
  // WHY: An empty card is not an attempt; submitting one would record a miss
  // the learner never made. The button and the Enter key share this one gate.
  const canSubmit = hasAnswerAttempt(card, answers);

  // WHY: A click on Complete takes the caret out of the field. The promised
  // Enter key needs the field focused again, so the accept path returns it.
  const answerRef = useRef<HTMLInputElement>(null);

  // WHY: The ghost is a beginner's teaching aid on the one typed answer surface,
  // and only while the card is still being answered. It is not a hint, so
  // accepting it does not cap the outcome.
  const completion =
    level === "beginner" && !result && !busy && (mode === "type" || mode === "hear_type")
      ? answerCompletion(answers.answer ?? "", card.answerDef.expected ?? [])
      : null;

  const acceptCompletion = () => {
    if (!completion) return;
    onAnswerChange({ ...answers, answer: completion.value });
    playCue("complete");
    const input = answerRef.current;
    if (input) {
      input.focus();
      requestAnimationFrame(() => {
        const end = input.value.length;
        input.setSelectionRange(end, end);
      });
    }
  };

  // WHY: Tab and the right arrow accept only at the end of the line, so both
  // keys keep their normal meaning for moving around and leaving the field.
  const answerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!completion || event.nativeEvent.isComposing) return;
    const input = event.currentTarget;
    const atEnd =
      input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
    if (!atEnd) return;
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      acceptCompletion();
      return;
    }
    if (
      event.key === "ArrowRight" &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      acceptCompletion();
    }
  };
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
        <div className="study-card-tools">
          {askPageRead && hasPage ? (
            <Link
              className={`chip study-chip ${pageRead ? "good" : "accent"}`}
              href={dictionaryHref}
              prefetch={false}
              aria-label={pageRead ? "Page read" : "Page not read"}
              title={pageRead ? "Page read — open the card page" : "Page not read — open the card page"}
            >
              {pageRead ? CHECK : BOOK}
              <span className="study-chip-word">{pageRead ? "Page read" : "Page not read"}</span>
            </Link>
          ) : null}
          {result ? (
            <span className={`outcome outcome-${result.cardOutcome} study-outcome`}>
              {OUTCOME_LABELS[result.cardOutcome]}
            </span>
          ) : (
            <button
              className="btn small study-tool"
              type="button"
              onClick={onHint}
              disabled={hintBusy}
              aria-label="Ask for a hint"
              title="Ask for a hint"
            >
              {BULB}
              <span className="study-tool-word">{hintBusy ? "Asking…" : "Hint"}</span>
            </button>
          )}
          <Link
            className="btn small study-tool"
            href={dictionaryHref}
            prefetch={false}
            aria-label="Dictionary"
            title="Dictionary — open the card page"
          >
            {BOOK}
            <span className="study-tool-word">Dictionary</span>
          </Link>
        </div>
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
            <div className="answer-field">
              <input
                className="answer-input"
                ref={answerRef}
                placeholder={mode === "hear_type" ? "Type what you hear" : "Your answer"}
                value={answers.answer ?? ""}
                onChange={(event) => onAnswerChange({ answer: event.target.value })}
                onKeyDown={answerKeyDown}
              />
              {completion ? (
                <span className="answer-ghost" aria-hidden="true">
                  <span className="answer-ghost-typed">{answers.answer ?? ""}</span>
                  {completion.suffix}
                </span>
              ) : null}
            </div>
          )}
          {card.answerDef.working ? (
            <textarea
              className="answer-input"
              placeholder={`${card.answerDef.working.label} (shown on screen, then discarded — nothing is sent)`}
              value={working}
              onChange={(event) => onWorkingChange(event.target.value)}
            />
          ) : null}
          {/* WHY: A learner who is stuck needs an exit from the gate, and a
              beginner needs a visible way to take the completion on a phone.
              Neither control ever fills the answer on its own. */}
          {mode !== "picks" ? (
            <div className="study-answer-aids">
              <span className="study-complete">
                {completion ? (
                  <>
                    <button className="study-link" type="button" onClick={acceptCompletion}>
                      Complete
                    </button>
                    <span className="muted study-complete-key">Tab or →</span>
                  </>
                ) : null}
              </span>
              <button
                className="study-link study-dont-know"
                type="button"
                onClick={() => onSubmit({})}
                disabled={busy}
                title="Reveals the answer and records this card as missed."
              >
                I don&apos;t know
              </button>
            </div>
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
              onClick={() => onSubmit()}
              disabled={busy || !canSubmit}
            >
              {busy ? "Checking…" : "Answer"}
            </button>
          </div>
        </>
      ) : (
        <div className="study-result">
          {askPageRead && hasPage && !pageRead ? (
            <div className="notice study-page-warning">
              <p style={{ margin: 0 }}>
                This course asks you to read the card page first. Your answer still counts.
              </p>
              <Link className="btn small" href={dictionaryHref} prefetch={false}>
                Read the card page
              </Link>
            </div>
          ) : null}
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
            <div className="study-next-group">
              <span className="study-enter">
                <kbd>Enter</kbd> to continue
              </span>
              <button
                className="btn primary"
                type="button"
                onClick={onNext}
                disabled={busy}
                aria-keyshortcuts="Enter"
              >
                {isLast ? "Finish" : "Next card"} <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
