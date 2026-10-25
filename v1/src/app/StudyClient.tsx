"use client";

// WHY: The session is the heart of the app, and its rules are locked: the plan
// comes first with plain reasons, hints cap at Nearly, wrong cards return once,
// and the session ends with no score of any kind. This screen owns that loop;
// the plan, the stage and the card are separate modules so the teaching layer
// can sit above the card without a second copy of the screen.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: static export prefetch is off; Next's RSC prefetch paths
// 404 on a plain file host. [pack: browser-app]
// 2026-10-25 opencode: the plan now uses the wide shell and a start rail, while
// the plan/answer rules stay untouched. [pack: learner-interface]
// 2026-10-25 opencode: the plan and the session now read as one calm column;
// all rules and saved shapes are unchanged. [pack: study-tab-redesign]

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend, ApiError } from "@/lib/client/api";
import { isWrong, OUTCOME_LABELS, worstOutcome } from "@/lib/core/outcome";
import { shouldAutoHint, studyCardInstruction } from "@/lib/client/study-view";
import type { AnswerResult, Card, Outcome, PackStatus, Plan } from "@/lib/shared/types";
import ScopePicker from "./study/ScopePicker";
import StudyCard from "./study/StudyCard";
import StudyPlan from "./study/StudyPlan";
import StudySession from "./study/StudySession";

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
      <div className="study-plan">
        <header className="study-plan-head">
          <div>
            <p className="study-eyebrow">Study</p>
            <h1 className="study-display">Nothing is laid out.</h1>
            <p className="study-lede">{message ?? "No cards yet."}</p>
          </div>
        </header>
        <div className="study-scope-row">
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
        </div>
        <div className="study-start-row">
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
    );
  }

  if (phase === "done") {
    return (
      <div className="study-plan">
        <header className="study-plan-head">
          <div>
            <p className="study-eyebrow">Study</p>
            <h1 className="study-display">This session is finished.</h1>
            <p className="study-lede">No score is kept. Nothing here was graded as a whole.</p>
          </div>
        </header>
        <div className="study-start-row">
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
    );
  }

  if (phase === "plan" && plan) {
    return (
      <StudyPlan
        plan={plan}
        packs={packs}
        scopePack={scopePack}
        scopeDeck={scopeDeck}
        offerChoice={offerChoice}
        approved={approved}
        onScopeChange={(nextPack, nextDeck) => {
          setScopePack(nextPack);
          setScopeDeck(nextDeck);
          void loadPlan(offerChoice, nextPack, nextDeck);
        }}
        onOfferChange={setOfferChoice}
        onRebuild={() => void loadPlan(offerChoice, scopePack, scopeDeck)}
        onApprove={setApproved}
        onStart={startSession}
      />
    );
  }

  if (phase === "running" && card) {
    const cardPack = packs.find((pack) => pack.name === card.packName) ?? null;
    const instruction = studyCardInstruction(card, cardPack);

    // The teaching layer arrives through StudySession's `aboveCard`; nothing
    // is reserved above the card while that layer is absent.
    return (
      <StudySession
        index={index}
        total={queue.length}
        fullStage={fullStage}
        busy={busy}
        stageRef={stageRef}
        onToggleFullScreen={() => (fullStage ? void exitFullScreen() : enterFullScreen())}
        onEnd={() => void finish(false, true)}
      >
        {message ? <div className="notice error">{message}</div> : null}
        <StudyCard
          card={card}
          answers={answers}
          onAnswerChange={setAnswers}
          working={working}
          onWorkingChange={setWorking}
          result={result}
          hintTexts={hintTexts}
          hintMessage={hintMessage}
          hintSource={hintSource}
          hintBusy={hintBusy}
          busy={busy}
          returned={returnedIds.includes(card.id)}
          instruction={instruction}
          isLast={index + 1 >= queue.length}
          onHint={askHint}
          onSubmit={() => void submitAnswer()}
          onNext={nextCard}
          onCorrect={(region, outcome) => void correct(region, outcome)}
        />
        {issueLines(message).length > 0 ? (
          <ul className="plain">
            {issueLines(message).map((line, position) => (
              <li key={position}>{line}</li>
            ))}
          </ul>
        ) : null}
        {result && hintTexts.length === 0 ? (
          <p className="study-foot">Hints were not used on this card.</p>
        ) : null}
      </StudySession>
    );
  }

  return <p className="muted">Nothing to show.</p>;
}
