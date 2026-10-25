"use client";

// WHY: The session is the heart of the app, and its rules are locked: the plan
// comes first with plain reasons, hints cap at Nearly, wrong cards return once,
// and the session ends with no score of any kind. This one screen holds that
// whole loop.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: static export prefetch is off; Next's RSC prefetch paths
// 404 on a plain file host. [pack: browser-app]
// 2026-10-25 opencode: the plan now uses the wide shell and a start rail, while
// the plan/answer rules stay untouched. [pack: learner-interface]

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend, ApiError } from "@/lib/client/api";
import { isWrong, OUTCOME_LABELS, OUTCOME_MEANINGS, worstOutcome } from "@/lib/core/outcome";
import {
  LISTEN_INSTRUCTION,
  listenPrompt,
  shouldAutoHint,
  studyCardInstruction,
  studyModeLabel,
} from "@/lib/client/study-view";
import type {
  AnswerResult,
  Card,
  CardPart,
  Outcome,
  PackStatus,
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
          // WHY: Pack parts arrive as separate strings; without a joining space
          // the answer reads "My jedliśmy obiad.We were eating dinner.".
          const next = parts[index + 1];
          const nextText = next?.type === "text" ? next.text : "";
          const needsSpace =
            index < parts.length - 1 &&
            !/\s$/.test(part.text) &&
            !/^[,.;:!?…]/.test(part.text) &&
            !/^[,.;:!?…]/.test(nextText);
          return (
            <span key={index}>
              {part.role === "translation" ? (
                <em className="study-translation">{part.text}</em>
              ) : (
                part.text
              )}
              {needsSpace ? " " : ""}
            </span>
          );
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

/** Pick a pack and, when it has decks, one deck. All cards is the default. */
function ScopePicker({
  packs,
  packName,
  deckId,
  onChange,
}: {
  packs: PackStatus[];
  packName: string;
  deckId: string;
  onChange: (packName: string, deckId: string) => void;
}) {
  const selected = packs.find((pack) => pack.name === packName) ?? null;
  const decks = selected?.decks ?? [];
  return (
    <div className="card study-scope">
      <label className="study-scope-field">
        <span>Study from</span>
        <span className="select-wrap">
          <select
            className="study-select"
            value={packName}
            onChange={(event) => onChange(event.target.value, "")}
          >
            <option value="">All cards</option>
            {packs.map((pack) => (
              <option key={pack.name} value={pack.name}>
                {pack.name}
              </option>
            ))}
          </select>
        </span>
      </label>
      {selected && decks.length > 0 ? (
        <label className="study-scope-field">
          <span>Deck</span>
          <span className="select-wrap">
            <select
              className="study-select"
              value={deckId}
              onChange={(event) => onChange(packName, event.target.value)}
            >
              <option value="">All decks</option>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))}
            </select>
          </span>
        </label>
      ) : null}
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
  const [packs, setPacks] = useState<PackStatus[]>([]);
  const [scopePack, setScopePack] = useState("");
  const [scopeDeck, setScopeDeck] = useState("");
  const [hintSource, setHintSource] = useState<string | null>(null);
  const [answered, setAnswered] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [fullStage, setFullStage] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const returnedRef = useRef<Set<string>>(new Set());
  const [returnedIds, setReturnedIds] = useState<string[]>([]);
  const startedRef = useRef<number>(0);
  const attemptsRef = useRef(0);
  const autoHintedRef = useRef<Set<string>>(new Set());
  const hintTokenRef = useRef(0);

  const card = queue[index] ?? null;
  const result = card ? results[card.id] : undefined;

  /** Leave the focused stage and release the browser fullscreen when present. */
  const exitFullScreen = useCallback(async () => {
    setFullStage(false);
    if (typeof document !== "undefined" && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // The browser may already be leaving fullscreen.
      }
    }
  }, []);

  /** Enter the fixed stage first, then ask the browser when it can. */
  const enterFullScreen = useCallback(() => {
    setFullStage(true);
    const stage = stageRef.current;
    if (stage?.requestFullscreen) {
      void stage.requestFullscreen().catch(() => {
        // The CSS stage is the deliberate fallback.
      });
    }
  }, []);

  /** Load a fresh plan; the offer and the chosen pack/deck may be adjusted. */
  const loadPlan = useCallback(async (offer?: number, packName = "", deckId = "") => {
    hintTokenRef.current += 1;
    setHintBusy(false);
    setPhase("loading");
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (offer !== undefined) params.set("offer", String(offer));
      if (packName) params.set("pack", packName);
      if (deckId) params.set("deck", deckId);
      const query = params.toString();
      const data = await apiGet<{ plan: Plan | null; message: string | null }>(
        query ? `/api/plan?${query}` : "/api/plan",
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
      autoHintedRef.current = new Set();
      setReturnedIds([]);
      attemptsRef.current = 0;
      setAnswered(0);
      setHintsUsed(0);
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

  // The scope choices come from the same pack list the Library uses.
  useEffect(() => {
    let cancelled = false;
    void apiGet<{ packs: PackStatus[] }>("/api/packs")
      .then((data) => {
        if (!cancelled) setPacks(data.packs);
      })
      .catch(() => {
        // The plan still works without the optional scope selector.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The stage hides the page behind it, so the page itself must stop scrolling.
  useEffect(() => {
    document.body.classList.toggle("full-stage", fullStage);
    return () => document.body.classList.remove("full-stage");
  }, [fullStage]);

  // A route change while the stage is open must not leave the browser stuck.
  useEffect(
    () => () => {
      if (typeof document !== "undefined" && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {
          // The page is already leaving.
        });
      }
    },
    [],
  );

  useEffect(() => {
    if (!fullStage) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void exitFullScreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitFullScreen, fullStage]);

  // Escape through the browser's own fullscreen path still clears our state.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullStage(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

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
    setHintSource(null);
    setHintUsed(false);
    setWorking("");
    hintTokenRef.current += 1;
    setHintBusy(false);
    autoHintedRef.current = new Set();
    setAnswered(0);
    setHintsUsed(0);
    setFullStage(false);
    setPhase("running");
  }, [plan]);

  const resetCardState = useCallback(() => {
    // WHY: A hint answer belongs to the card that asked. Bumping the token
    // makes every older response invisible, and clears its busy state here.
    hintTokenRef.current += 1;
    setHintBusy(false);
    setAnswers({});
    setHintTexts([]);
    setHintMessage(null);
    setHintSource(null);
    setHintUsed(false);
    setWorking("");
  }, []);

  const finish = useCallback(
    async (completed: boolean, stopped: boolean) => {
      if (!plan) return;
      void exitFullScreen();
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
        await loadPlan(undefined, scopePack, scopeDeck);
        return;
      }
      setPhase("done");
    },
    [exitFullScreen, loadPlan, plan, scopeDeck, scopePack],
  );

  const requestHint = useCallback(
    async (outcomeCategory?: string, automatic = false) => {
      if (!card || hintBusy) return;
      const token = ++hintTokenRef.current;
      const requestedCard = card.id;
      const current = () => token === hintTokenRef.current && card.id === requestedCard;
      setHintBusy(true);
      setHintMessage(null);
      try {
        const data = await apiSend<{
          text: string | null;
          source: string;
          prompt: string | null;
          providerMessage: string | null;
        }>("/api/provider/hint", "POST", {
          cardId: requestedCard,
          approved: approved === "yes",
          usedHints: hintTexts,
          outcomeCategory:
            outcomeCategory ??
            (result ? OUTCOME_LABELS[result.cardOutcome] : "not answered yet"),
        });
        if (!current()) return;
        if (data.text) {
          setHintTexts((previous) => [...previous, data.text as string]);
          setHintsUsed((previous) => previous + 1);
          setHintSource(data.source);
          setHintUsed(true);
        }
        if (data.providerMessage) setHintMessage(data.providerMessage);
        if (!data.text && !data.providerMessage) {
          setHintMessage(
            automatic ? "The tutor had no hint for this one." : "No hint is available for this card.",
          );
        }
      } catch (error) {
        if (!current()) return;
        setHintMessage(error instanceof Error ? error.message : "The hint could not be asked for.");
      } finally {
        // A late hint must not clear the busy state of the card the learner
        // moved to, because that card may be waiting on its own request.
        if (token === hintTokenRef.current) setHintBusy(false);
      }
    },
    [approved, card, hintBusy, hintTexts, result],
  );

  const askHint = useCallback(() => {
    void requestHint();
  }, [requestHint]);

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
      setAnswered((previous) => previous + 1);
      setResults((previous) => ({ ...previous, [card.id]: response }));
      // Only genuinely wrong cards return (Again or No). Nearly is not wrong.
      if (isWrong(response.cardOutcome) && !returnedRef.current.has(card.id)) {
        returnedRef.current.add(card.id);
        setReturnedIds((previous) => [...previous, card.id]);
        setQueue((previous) => [...previous, card]);
      }
      // A tutor that is on should do something without being asked: one hint
      // after the first miss on this card, never a stream.
      if (
        shouldAutoHint({
          approved: approved === "yes",
          outcome: response.cardOutcome,
          alreadyAutoHinted: autoHintedRef.current.has(card.id),
        })
      ) {
        autoHintedRef.current.add(card.id);
        void requestHint(OUTCOME_LABELS[response.cardOutcome], true);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The answer could not be judged.");
    } finally {
      setBusy(false);
    }
  }, [answers, approved, busy, card, hintUsed, requestHint]);

  const nextCard = useCallback(() => {
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      resetCardState();
    } else {
      void finish(true, false);
    }
  }, [finish, index, queue.length, resetCardState]);

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
        <ScopePicker
          packs={packs}
          packName={scopePack}
          deckId={scopeDeck}
          onChange={(nextPack, nextDeck) => {
            setScopePack(nextPack);
            setScopeDeck(nextDeck);
            void loadPlan(undefined, nextPack, nextDeck);
          }}
        />
        <div className="card">
          <p>{message ?? "No cards yet."}</p>
          <div className="row">
            {scopePack ? (
              <button
                className="btn primary"
                type="button"
                onClick={() => {
                  setScopePack("");
                  setScopeDeck("");
                  void loadPlan();
                }}
              >
                Study all cards
              </button>
            ) : null}
            <Link className="btn" href="/library" prefetch={false}>
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
            <button
              className="btn primary"
              type="button"
              onClick={() => void loadPlan(undefined, scopePack, scopeDeck)}
            >
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
    const selectedPack = packs.find((pack) => pack.name === scopePack) ?? null;
    const selectedDeck = selectedPack?.decks?.find((deck) => deck.id === scopeDeck) ?? null;
    const scopeText = selectedPack
      ? `${selectedPack.name}${selectedDeck ? ` / ${selectedDeck.name}` : ""}`
      : "the whole library";
    return (
      <div className="study-plan-layout">
        <header className="study-plan-head">
          <p className="study-eyebrow">Study</p>
          <h1>Today&apos;s session</h1>
          <p className="lead">
            {plan.cards.length} {plan.cards.length === 1 ? "card" : "cards"} from {scopeText}{" "}
            {plan.cards.length === 1 ? "is" : "are"} laid out. It is an offer — stop whenever you
            like.
          </p>
        </header>

        <div className="study-plan-main">
          <ScopePicker
            packs={packs}
            packName={scopePack}
            deckId={scopeDeck}
            onChange={(nextPack, nextDeck) => {
              setScopePack(nextPack);
              setScopeDeck(nextDeck);
              void loadPlan(offerChoice, nextPack, nextDeck);
            }}
          />

          <div className="card plan-bar">
            <label className="plan-offer">
              <span>Cards offered</span>
              <input
                className="field"
                type="number"
                min={5}
                max={40}
                step={5}
                value={offerChoice}
                onChange={(event) => setOfferChoice(Math.max(1, Number(event.target.value) || 5))}
              />
            </label>
            <button
              className="btn small"
              type="button"
              onClick={() => void loadPlan(offerChoice, scopePack, scopeDeck)}
            >
              Rebuild the plan
            </button>
          </div>
        </div>

        <aside className="rail study-plan-rail">
          <section className="card study-plan-start">
            <div>
              <p className="study-eyebrow">Ready</p>
              <p className="study-plan-count">
                {plan.cards.length}
                <span>{plan.cards.length === 1 ? "card in this offer" : "cards in this offer"}</span>
              </p>
              <p className="study-plan-source">from {scopeText}</p>
            </div>
            <dl className="study-plan-facts">
              <div>
                <dt>Tutor</dt>
                <dd>{approved === "yes" ? "On" : "Off"}</dd>
              </div>
              <div>
                <dt>Score</dt>
                <dd>None kept</dd>
              </div>
            </dl>
            <button
              className="btn primary study-start-btn"
              type="button"
              onClick={startSession}
              disabled={plan.cards.length === 0}
            >
              Start session
            </button>
            <p className="muted small study-plan-calm">
              Stopping is not an ending. Stop whenever you like.
            </p>
          </section>

          <section className="card tight">
            <h3>What to expect</h3>
            <ul className="study-plan-rules">
              <li>Hints come from the pack or the tutor.</li>
              <li>A missed card returns once.</li>
              <li>The full line appears after you answer.</li>
            </ul>
          </section>
        </aside>

        <div className="study-plan-details">
          <details className="disclosure">
            <summary>Why these cards</summary>
            {plan.groups.length === 0 ? (
              <p className="muted">Nothing stood out, so the plan takes a fair spread.</p>
            ) : (
              <ul className="plain">
                {plan.groups.map((group) => (
                  <li key={group.topic}>
                    <strong>{group.label}</strong> — {group.reason}{" "}
                    <span className="chip">
                      {group.cardIds.length} {group.cardIds.length === 1 ? "card" : "cards"}
                    </span>
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
          {approved === "yes" ? (
            <p className="muted study-tutor-note">
              The tutor will offer a hint after a missed answer.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (phase === "running" && card) {
    const mode = card.answerDef.mode;
    const canSubmit = mode !== "picks" || (answers.choice ?? "").length > 0;
    const regionLabel = (region: string | null) =>
      region === null ? "The answer" : `Blank ${blanks.findIndex((part) => part.id === region) + 1}`;
    const listen = mode === "hear_type" ? listenPrompt(card) : null;
    const cardPack = packs.find((pack) => pack.name === card.packName) ?? null;
    const instruction = studyCardInstruction(card, cardPack);
    const selectedDeck = cardPack?.decks?.find((deck) => deck.id === card.deckId) ?? null;
    const scopeLabel = cardPack
      ? `${cardPack.name}${selectedDeck ? ` / ${selectedDeck.name}` : ""}`
      : "This session";
    const left = Math.max(0, queue.length - index - (result ? 1 : 0));
    const progress = queue.length > 0 ? ((index + (result ? 1 : 0)) / queue.length) * 100 : 0;

    return (
      <div className="study-layout">
        <div
          ref={stageRef}
          className={`study-stage study-focus${fullStage ? " stage-full" : ""}`}
        >
          <div className="study-stage-inner">
            <div className="study-head">
              <span className="muted">
                Card {index + 1} of {queue.length}
              </span>
              <div className="row">
                {approved === "yes" ? <span className="chip study-tutor-chip">Tutor on</span> : null}
                <button
                  className="btn small"
                  type="button"
                  onClick={() => (fullStage ? void exitFullScreen() : enterFullScreen())}
                  aria-pressed={fullStage}
                >
                  {fullStage ? "Exit full screen" : "Full screen"}
                </button>
                <button className="btn small" type="button" onClick={() => void finish(false, true)} disabled={busy}>
                  End here
                </button>
              </div>
            </div>

            <div
              className="study-progress"
              role="progressbar"
              aria-label="Card progress"
              aria-valuemin={0}
              aria-valuemax={queue.length}
              aria-valuenow={index + 1}
            >
              <span style={{ width: `${Math.max(6, progress)}%` }} />
            </div>

            {message ? <div className="notice error">{message}</div> : null}

            <div className="card study-card">
              <div className="study-card-top">
                <span className="study-mode">{studyModeLabel(mode)}</span>
                <button className="btn small" type="button" onClick={() => void askHint()} disabled={hintBusy}>
                  {hintBusy ? "Asking…" : hintTexts.length > 0 ? "Ask for another hint" : "Ask for a hint"}
                </button>
              </div>

              <p className="muted study-instruction">{instruction}</p>

              {returnedIds.includes(card.id) ? (
                <p className="muted study-returned">
                  This one is marked to return once — it was missed in this session.
                </p>
              ) : null}

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
                <Side
                  parts={card.prompt}
                  answers={answers}
                  setAnswer={(id, value) => setAnswers((previous) => ({ ...previous, [id]: value }))}
                  interactive
                />
              )}

              {hintTexts.length > 0 ? (
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
                      placeholder={mode === "hear_type" ? "Type what you hear" : "Your answer"}
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
                <div className="study-result">
                  <div className="study-result-head">
                    <span className={`outcome outcome-${result.cardOutcome} study-outcome`}>
                      {OUTCOME_LABELS[result.cardOutcome]}
                    </span>
                    {card.summary ? <span className="study-summary">{card.summary}</span> : null}
                  </div>

                  <div className="study-answer">
                    <p className="study-label">Answer</p>
                    <Side parts={card.answer} />
                  </div>

                  {result.capped ? (
                    <p className="muted study-capped">A hint capped this at Nearly.</p>
                  ) : null}

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

                  <details className="study-adjust">
                    <summary>Was this fair?</summary>
                    <div className="study-adjust-list">
                      {result.results.map((region, position) => (
                        <div className="region-row study-region" key={`${region.region ?? "whole"}-${position}`}>
                          <div>
                            <span className="muted">{regionLabel(region.region)}</span>{" "}
                            <span className={`outcome outcome-${region.outcome}`}>
                              {OUTCOME_LABELS[region.outcome]}
                            </span>
                            <div className="muted study-region-detail">
                              You wrote “{region.given || "(nothing)"}”; expected “
                              {region.expected.join(" / ")}”.
                            </div>
                          </div>
                          <div className="row study-corrections">
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
                    </div>
                  </details>

                  <div className="study-actions">
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
        </div>

        <aside className="rail study-rail">
          <section className="card tight">
            <div className="study-rail-head">
              <div>
                <h3>This session</h3>
                <p className="muted small">{scopeLabel}</p>
              </div>
              <span className="badge">{approved === "yes" ? "Tutor on" : "Tutor off"}</span>
            </div>
            <div className="stat-grid" style={{ marginTop: 12 }}>
              <div className="stat">
                <strong>{queue.length}</strong>
                <span>cards offered</span>
              </div>
              <div className="stat">
                <strong>{answered}</strong>
                <span>answered</span>
              </div>
              <div className="stat">
                <strong>{left}</strong>
                <span>left</span>
              </div>
              <div className="stat">
                <strong>{hintsUsed}</strong>
                <span>hints used</span>
              </div>
            </div>
            <button
              className="btn"
              type="button"
              style={{ width: "100%", marginTop: 12 }}
              onClick={() => void finish(false, true)}
              disabled={busy}
            >
              End this session
            </button>
          </section>

          <section className="card tight">
            <h3>Full screen</h3>
            <p className="muted small" style={{ marginTop: 6 }}>
              Full screen hides the sidebar and this rail. Esc or the same control brings them back.
              Your card and answer stay put.
            </p>
          </section>
        </aside>
      </div>
    );
  }

  return <p className="muted">Nothing to show.</p>;
}
