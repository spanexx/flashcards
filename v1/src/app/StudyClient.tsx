"use client";

// WHY: The session is the heart of the app, and its rules are locked: the plan
// comes first with plain reasons, hints cap at Nearly, wrong cards return once,
// and the session ends with no score of any kind. This one screen holds that
// whole loop.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: static export prefetch is off; Next's RSC prefetch paths
// 404 on a plain file host. [pack: browser-app]

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend, ApiError } from "@/lib/client/api";
import { isWrong, OUTCOME_LABELS, OUTCOME_MEANINGS, worstOutcome } from "@/lib/core/outcome";
import type {
  AnswerResult,
  Card,
  CardPart,
  Outcome,
  Plan,
  TutorBanner,
} from "@/lib/shared/types";

type Phase = "loading" | "empty" | "plan" | "running" | "done" | "error";

/** Read a number out of an error detail list, for plain display. */
function issueLines(error: unknown): string[] {
  if (!(error instanceof ApiError) || !Array.isArray(error.detail)) return [];
  return error.detail
    .map((item) => {
      if (item && typeof item === "object") {
        const record = item as { field?: unknown; message?: unknown };
        const field = typeof record.field === "string" ? record.field : null;
        const message = typeof record.message === "string" ? record.message : null;
        if (message) return field ? `${field}: ${message}` : message;
      }
      return null;
    })
    .filter((line): line is string => line !== null);
}

/** Speak text out loud, when the browser can. */
function speak(text: string, lang?: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  if (lang) utterance.lang = lang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function blankWidth(part: Extract<CardPart, { type: "blank" }>): string {
  if (part.width === "long") return "16ch";
  if (part.width === "medium") return "11ch";
  return "7ch";
}

/** Render one side. Interactive mode turns blanks into inputs. */
function Side({
  parts,
  answers,
  setAnswer,
  interactive,
}: {
  parts: CardPart[];
  answers?: Record<string, string>;
  setAnswer?: (id: string, value: string) => void;
  interactive?: boolean;
}) {
  return (
    <div className={interactive ? "prompt-text" : undefined}>
      {parts.map((part, index) => {
        if (part.type === "text") {
          return <span key={index}>{part.role === "translation" ? <em>{part.text}</em> : part.text}</span>;
        }
        if (part.type === "code") {
          return (
            <pre className="code-block" key={index}>
              {part.text}
            </pre>
          );
        }
        if (part.type === "speak") {
          return (
            <span key={index}>
              <button type="button" className="btn small" onClick={() => speak(part.text, part.lang)}>
                Hear it
              </button>{" "}
              {part.label ? <span className="muted">{part.label}</span> : null}
            </span>
          );
        }
        if (part.type === "media") {
          return (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={index} src={part.src} alt={part.alt ?? ""} style={{ maxWidth: "100%", borderRadius: 8 }} />
          );
        }
        return (
          <input
            key={part.id}
            className="blank-input"
            style={{ width: blankWidth(part) }}
            value={answers?.[part.id] ?? ""}
            placeholder={part.hint ?? ""}
            disabled={!interactive}
            onChange={(event) => setAnswer?.(part.id, event.target.value)}
          />
        );
      })}
    </div>
  );
}

export default function StudyClient() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [queue, setQueue] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, AnswerResult>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hintTexts, setHintTexts] = useState<string[]>([]);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintBusy, setHintBusy] = useState(false);
  const [approved, setApproved] = useState<"none" | "yes" | "no">("none");
  const [offerChoice, setOfferChoice] = useState(20);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState("");

  const returnedRef = useRef<Set<string>>(new Set());
  const [returnedIds, setReturnedIds] = useState<string[]>([]);
  const startedRef = useRef<number>(0);
  const attemptsRef = useRef(0);

  const card = queue[index] ?? null;
  const result = card ? results[card.id] : undefined;

  /** Load a fresh plan; the offer may be adjusted before any card is seen. */
  const loadPlan = useCallback(async (offer?: number) => {
    setPhase("loading");
    setMessage(null);
    try {
      const data = await apiGet<{ plan: Plan | null; message: string | null }>(
        offer === undefined ? "/api/plan" : `/api/plan?offer=${offer}`,
      );
      if (!data.plan) {
        setPlan(null);
        setMessage(data.message);
        setPhase("empty");
        return;
      }
      setPlan(data.plan);
      setOfferChoice(data.plan.offer);
      setQueue([]);
      setIndex(0);
      setResults({});
      returnedRef.current = new Set();
      setReturnedIds([]);
      attemptsRef.current = 0;
      setPhase("plan");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The plan could not be built.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    const pending = Promise.resolve().then(() => loadPlan());
    return () => {
      void pending;
    };
  }, [loadPlan]);

  useEffect(() => {
    startedRef.current = Date.now();
  }, [index]);

  const startSession = useCallback(() => {
    if (!plan) return;
    startedRef.current = Date.now();
    setQueue(plan.cards);
    setIndex(0);
    setAnswers({});
    setHintTexts([]);
    setHintMessage(null);
    setHintUsed(false);
    setWorking("");
    setPhase("running");
  }, [plan]);

  const resetCardState = useCallback(() => {
    setAnswers({});
    setHintTexts([]);
    setHintMessage(null);
    setHintUsed(false);
    setWorking("");
  }, []);

  const finish = useCallback(
    async (completed: boolean, stopped: boolean) => {
      if (!plan) return;
      setBusy(true);
      try {
        await apiSend("/api/session/end", "POST", {
          sessionId: plan.sessionId,
          offered: plan.offer,
          answered: attemptsRef.current,
          completed,
          stopped,
        });
      } catch {
        // A session-end hiccup should never trap the learner; the offer simply
        // stays as it was.
      }
      setBusy(false);
      if (stopped) {
        // Stopping is not an ending: no sign-off, just a calm return to the plan.
        await loadPlan();
        return;
      }
      setPhase("done");
    },
    [loadPlan, plan],
  );

  const submitAnswer = useCallback(async () => {
    if (!card || busy) return;
    setBusy(true);
    try {
      const response = await apiSend<AnswerResult>("/api/answer", "POST", {
        cardId: card.id,
        answers,
        timeMs: Date.now() - startedRef.current,
        hintUsed,
      });
      attemptsRef.current += 1;
      setResults((previous) => ({ ...previous, [card.id]: response }));
      // Only genuinely wrong cards return (Again or No). Nearly is not wrong.
      if (isWrong(response.cardOutcome) && !returnedRef.current.has(card.id)) {
        returnedRef.current.add(card.id);
        setReturnedIds((previous) => [...previous, card.id]);
        setQueue((previous) => [...previous, card]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The answer could not be judged.");
    } finally {
      setBusy(false);
    }
  }, [answers, busy, card, hintUsed]);

  const nextCard = useCallback(() => {
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      resetCardState();
    } else {
      void finish(true, false);
    }
  }, [finish, index, queue.length, resetCardState]);

  const askHint = useCallback(async () => {
    if (!card || hintBusy) return;
    setHintBusy(true);
    setHintMessage(null);
    try {
      const data = await apiSend<{
        text: string | null;
        source: string;
        prompt: string | null;
        providerMessage: string | null;
      }>("/api/provider/hint", "POST", {
        cardId: card.id,
        approved: approved === "yes",
        usedHints: hintTexts,
        outcomeCategory: result ? OUTCOME_LABELS[result.cardOutcome] : "not answered yet",
      });
      if (data.text) {
        setHintTexts((previous) => [...previous, data.text as string]);
        setHintUsed(true);
      }
      if (data.providerMessage) setHintMessage(data.providerMessage);
      if (!data.text && !data.providerMessage) setHintMessage("No hint is available for this card.");
    } catch (error) {
      setHintMessage(error instanceof Error ? error.message : "The hint could not be asked for.");
    } finally {
      setHintBusy(false);
    }
  }, [approved, card, hintBusy, hintTexts, result]);

  const correct = useCallback(
    async (region: string | null, outcome: Outcome) => {
      if (!card || !result) return;
      const row = result.rows.find((entry) => entry.region === region);
      if (!row) return;
      try {
        await apiSend("/api/evidence/correction", "POST", { rowId: row.id, outcome });
        setResults((previous) => {
          const current = previous[card.id];
          if (!current) return previous;
          const nextResults = current.results.map((entry) =>
            entry.region === region ? { ...entry, outcome } : entry,
          );
          return {
            ...previous,
            [card.id]: {
              ...current,
              results: nextResults,
              cardOutcome: worstOutcome(nextResults.map((entry) => entry.outcome)),
            },
          };
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The correction could not be saved.");
      }
    },
    [card, result],
  );

  const blanks = useMemo(
    () => (card ? card.prompt.filter((part): part is Extract<CardPart, { type: "blank" }> => part.type === "blank") : []),
    [card],
  );

  if (phase === "loading") {
    return <p className="muted">Laying out today&apos;s session…</p>;
  }

  if (phase === "error") {
    return (
      <div>
        <h1>Study</h1>
        <div className="notice error">{message}</div>
        <button className="btn" type="button" onClick={() => void loadPlan()}>
          Try again
        </button>
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <div>
        <h1>Study</h1>
        <div className="card">
          <p>{message ?? "No cards yet."}</p>
          <div className="row">
            <Link className="btn primary" href="/library" prefetch={false}>
              Open the library
            </Link>
            <Link className="btn" href="/settings" prefetch={false}>
              Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div>
        <h1>This session is finished.</h1>
        <div className="card">
          <div className="row">
            <button className="btn primary" type="button" onClick={() => void loadPlan()}>
              Study again
            </button>
            <Link className="btn" href="/progress" prefetch={false}>
              Look at progress
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "plan" && plan) {
    const banner: TutorBanner | null = plan.banner;
    return (
      <div>
        <h1>Today&apos;s session</h1>
        <p className="lead">
          {plan.offer} cards are laid out. It is an offer — stop whenever you like.
        </p>

        <div className="card plan-bar">
          <label>
            Cards offered:{" "}
            <input
              className="field"
              type="number"
              min={5}
              max={40}
              step={5}
              value={offerChoice}
              onChange={(event) => setOfferChoice(Math.max(1, Number(event.target.value) || 5))}
              style={{ width: "5.5rem" }}
            />
          </label>
          <button className="btn small" type="button" onClick={() => void loadPlan(offerChoice)}>
            Rebuild the plan
          </button>
          <span className="grow" />
          <button className="btn primary" type="button" onClick={startSession} disabled={plan.cards.length === 0}>
            Start
          </button>
        </div>

        <details className="disclosure">
          <summary>Why these cards</summary>
          {plan.groups.length === 0 ? (
            <p className="muted">Nothing stood out, so the plan takes a fair spread.</p>
          ) : (
            <ul className="plain">
              {plan.groups.map((group) => (
                <li key={group.topic}>
                  <strong>{group.label}</strong> — {group.reason}{" "}
                  <span className="chip">{group.cardIds.length} cards</span>
                </li>
              ))}
            </ul>
          )}
        </details>

        <details className="disclosure">
          <summary>{banner?.available ? "The tutor and hints" : "Hints"}</summary>
          {banner && banner.available ? (
            <>
              <h2 style={{ marginTop: 0 }}>The tutor</h2>
              {approved === "none" ? (
                <>
                  <p>
                    A tutor could help with hints this session, using <strong>{banner.model}</strong> at{" "}
                    <strong>{banner.endpoint}</strong>.
                  </p>
                  <ul className="plain">
                    <li>It sees {banner.slots.join(", ")}.</li>
                    <li>It never sees what you type.</li>
                  </ul>
                  <details className="disclosure">
                    <summary>Show the exact shape of what it would see</summary>
                    <pre className="code-block">{banner.shape}</pre>
                  </details>
                  <div className="row" style={{ marginTop: 12 }}>
                    <button className="btn primary" type="button" onClick={() => setApproved("yes")}>
                      Turn the tutor on for this session
                    </button>
                    <button className="btn" type="button" onClick={() => setApproved("no")}>
                      Keep it off
                    </button>
                  </div>
                </>
              ) : approved === "yes" ? (
                <p className="muted">
                  The tutor is on for this session. <button className="btn small" type="button" onClick={() => setApproved("no")}>Turn it off</button>
                </p>
              ) : (
                <p className="muted">
                  The tutor is off. Hints will come from the pack itself.{" "}
                  <button className="btn small" type="button" onClick={() => setApproved("yes")}>
                    Turn it on
                  </button>
                </p>
              )}
            </>
          ) : (
            <p className="muted">No tutor is set up. Hints come from the pack itself, if it ships any.</p>
          )}
        </details>
      </div>
    );
  }

  if (phase === "running" && card) {
    const mode = card.answerDef.mode;
    const canSubmit = mode !== "picks" || (answers.choice ?? "").length > 0;
    const regionLabel = (region: string | null) =>
      region === null ? "The answer" : `Blank ${blanks.findIndex((part) => part.id === region) + 1}`;

    return (
      <div className="focus">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="muted">
            Card {index + 1} of {queue.length}
            {approved === "yes" ? " · tutor on" : ""}
          </span>
          <button className="btn small" type="button" onClick={() => void finish(false, true)} disabled={busy}>
            End here
          </button>
        </div>

        {message ? <div className="notice error">{message}</div> : null}

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="chip">{card.summary}</span>
            <button className="btn small" type="button" onClick={() => void askHint()} disabled={hintBusy}>
              {hintBusy ? "Asking…" : hintTexts.length > 0 ? "Ask for another hint" : "Ask for a hint"}
            </button>
          </div>

          {returnedIds.includes(card.id) ? (
            <p className="muted" style={{ marginTop: 8 }}>
              This one came back — it was missed earlier in this session. It returns once.
            </p>
          ) : null}

          {mode === "hear_type" ? (
            <p>
              <button
                className="btn"
                type="button"
                onClick={() => speak(card.prompt.filter((part) => part.type === "speak").map((part) => (part.type === "speak" ? part.text : "")).join(" ") || card.fullLine || card.summary)}
              >
                Play it again
              </button>
            </p>
          ) : null}

          <Side parts={card.prompt} answers={answers} setAnswer={(id, value) => setAnswers((previous) => ({ ...previous, [id]: value }))} interactive />

          {hintTexts.length > 0 ? (
            <div className="notice">
              {hintTexts.map((text, position) => (
                <p key={position} style={{ margin: "4px 0" }}>
                  {text}
                </p>
              ))}
              {hintMessage ? <p className="muted" style={{ margin: 0 }}>{hintMessage}</p> : null}
            </div>
          ) : hintMessage ? (
            <div className="notice">{hintMessage}</div>
          ) : null}

          {!result ? (
            <div className="stack" style={{ marginTop: 14 }}>
              {mode === "picks" ? (
                <div className="options">
                  {(card.answerDef.options ?? []).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="option"
                      aria-pressed={answers.choice === option}
                      onClick={() => setAnswers({ choice: option })}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : mode === "cloze" ? null : (
                <input
                  className="answer-input"
                  placeholder="Your answer"
                  value={answers.answer ?? ""}
                  onChange={(event) => setAnswers({ answer: event.target.value })}
                />
              )}
              {card.answerDef.working ? (
                <textarea
                  className="answer-input"
                  placeholder={`${card.answerDef.working.label} (shown on screen, then discarded — nothing is sent)`}
                  value={working}
                  onChange={(event) => setWorking(event.target.value)}
                />
              ) : null}
              <div>
                <button className="btn primary" type="button" onClick={() => void submitAnswer()} disabled={busy || !canSubmit}>
                  {busy ? "Checking…" : "Answer"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <div className="answer-side">
                <Side parts={card.answer} />
              </div>

              {card.answerDef.working ? (
                <div className="notice">
                  <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <p className="muted" style={{ margin: 0 }}>Your working</p>
                      <p style={{ margin: "4px 0 0" }}>{working.trim().length > 0 ? working : "(nothing written)"}</p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p className="muted" style={{ margin: 0 }}>{card.answerDef.working.label}</p>
                      <p style={{ margin: "4px 0 0" }}>{card.answerDef.working.expected}</p>
                    </div>
                  </div>
                  <p className="muted" style={{ margin: "8px 0 0" }}>
                    Side by side for a moment. Nothing here was saved or sent.
                  </p>
                </div>
              ) : null}

              {result.results.map((region, position) => (
                <div className="region-row" key={`${region.region ?? "whole"}-${position}`}>
                  <div>
                    <span className="muted">{regionLabel(region.region)}</span>{" "}
                    <span className={`outcome outcome-${region.outcome}`}>{OUTCOME_LABELS[region.outcome]}</span>
                    <div className="muted">
                      You wrote “{region.given || "(nothing)"}”; expected “{region.expected.join(" / ")}”.
                      {result.capped ? " A hint capped this at Nearly." : ""}
                    </div>
                  </div>
                  <div className="row">
                    <button className="btn small" type="button" title={OUTCOME_MEANINGS.got_it} onClick={() => void correct(region.region, "got_it")}>
                      I got it
                    </button>
                    <button className="btn small" type="button" title={OUTCOME_MEANINGS.nearly} onClick={() => void correct(region.region, "nearly")}>
                      Nearly
                    </button>
                    <button className="btn small" type="button" title={OUTCOME_MEANINGS.again} onClick={() => void correct(region.region, "again")}>
                      I missed it
                    </button>
                    <button className="btn small" type="button" title={OUTCOME_MEANINGS.no} onClick={() => void correct(region.region, "no")}>
                      No
                    </button>
                  </div>
                </div>
              ))}

              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn primary" type="button" onClick={nextCard} disabled={busy}>
                  {index + 1 < queue.length ? "Next card" : "Finish"}
                </button>
                <Link
                  className="btn"
                  href={`/library?card=${encodeURIComponent(card.id)}`}
                  prefetch={false}
                >
                  Look at this card&apos;s record
                </Link>
              </div>
            </div>
          )}
        </div>

        {issueLines(message).length > 0 ? (
          <ul className="plain">
            {issueLines(message).map((line, position) => (
              <li key={position}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return <p className="muted">Nothing to show.</p>;
}
