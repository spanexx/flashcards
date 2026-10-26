"use client";

// WHY: The session is the heart of the app, and its rules are locked: the plan
// comes first with plain reasons, hints cap at Nearly, the deck's level decides
// how its teaching layer appears, and one card may return once for one reason.
// The plan, the stage, the card and the layer are separate modules so the layer
// can sit above the card without a second copy of the screen.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: static export prefetch is off; Next's RSC prefetch paths
// 404 on a plain file host. [pack: browser-app]
// 2026-10-25 opencode: the plan and the session now read as one calm column;
// all rules and saved shapes are unchanged. [pack: study-tab-redesign]
// 2026-10-25 opencode: merged the teaching-layers queue and return rule into
// the redesigned stage. [pack: teaching-layers]
// 2026-10-25 opencode: optional cues on a judged answer and a finished
// session. [pack: learner-delight]

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend, ApiError } from "@/lib/client/api";
import { isWrong, OUTCOME_LABELS, worstOutcome } from "@/lib/core/outcome";
import { shouldAutoHint, studyCardInstruction } from "@/lib/client/study-view";
import { cueForOutcome, playCue } from "@/lib/client/sound";
import {
  deckLevelFor,
  layerBarText,
  layerPolicy,
  returnReason,
} from "@/lib/client/layer";
import { newId } from "@/lib/core/id";
import type { AnswerResult, Card, Outcome, PackStatus, Plan } from "@/lib/shared/types";
import ScopePicker from "./study/ScopePicker";
import StudyCard from "./study/StudyCard";
import StudyPlan from "./study/StudyPlan";
import StudySession from "./study/StudySession";
import TeachingLayer from "./study/TeachingLayer";

type Phase = "loading" | "empty" | "plan" | "running" | "done" | "error";

/** One trip through the card. A return is a new entry, never the same one. */
interface QueueEntry {
  entryId: string;
  card: Card;
  coldCheck: boolean;
  suppressTeaching: boolean;
  /** Why this entry exists; the first showing has no reason. */
  returnKind: "cold" | "wrong" | null;
}

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
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, AnswerResult>>({});
  const [answersByEntry, setAnswersByEntry] = useState<Record<string, Record<string, string>>>({});
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
  const [layerUi, setLayerUi] = useState<{ entryId: string; open: boolean } | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const returnedRef = useRef<Set<string>>(new Set());
  const peekedRef = useRef<Set<string>>(new Set());
  const entryIdRef = useRef<string>("");
  const startedRef = useRef<number>(0);
  const attemptsRef = useRef(0);
  const autoHintedRef = useRef<Set<string>>(new Set());
  const hintTokenRef = useRef(0);

  const entry = queue[index] ?? null;
  const card = entry?.card ?? null;
  const result = entry ? results[entry.entryId] : undefined;
  const answers = useMemo(
    () => (entry ? (answersByEntry[entry.entryId] ?? {}) : {}),
    [answersByEntry, entry],
  );
  const level = card ? deckLevelFor(card, packs) : "intermediate";
  const policy = layerPolicy(level, Boolean(card?.teaching?.length) && !entry?.suppressTeaching);
  const layerOpen =
    policy.hasLayer &&
    (layerUi?.entryId === entry?.entryId ? layerUi.open : policy.before === "open");
  const layerBarAvailable =
    policy.hasLayer && (Boolean(result) || policy.before !== "hidden");

  // Hints and late answers belong to one entry, because one card can come back.
  useEffect(() => {
    entryIdRef.current = entry?.entryId ?? "";
  }, [entry]);

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

  /** Replace the current entry's answers; a return starts with its own map. */
  const updateAnswers = useCallback(
    (next: Record<string, string>) => {
      if (!entry) return;
      setAnswersByEntry((previous) => ({ ...previous, [entry.entryId]: next }));
    },
    [entry],
  );

  /** Open the layer, and remember a peek that happened before the answer. */
  const openTeaching = useCallback(() => {
    if (!entry || !policy.hasLayer) return;
    if (level === "advanced" && !result) return;
    if (level === "intermediate" && !result) peekedRef.current.add(entry.entryId);
    setLayerUi({ entryId: entry.entryId, open: true });
  }, [entry, level, policy.hasLayer, result]);

  const closeTeaching = useCallback(() => {
    if (!entry) return;
    setLayerUi({ entryId: entry.entryId, open: false });
  }, [entry]);

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
      setAnswersByEntry({});
      returnedRef.current = new Set();
      peekedRef.current = new Set();
      autoHintedRef.current = new Set();
      setLayerUi(null);
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
    if (!fullStage && !layerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Escape closes the layer first, because that is the thing on top.
      if (layerOpen) {
        event.preventDefault();
        closeTeaching();
        return;
      }
      event.preventDefault();
      void exitFullScreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeTeaching, exitFullScreen, fullStage, layerOpen]);

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
    setQueue(
      plan.cards.map((card) => ({
        entryId: newId(),
        card,
        coldCheck: false,
        suppressTeaching: false,
        returnKind: null,
      })),
    );
    setIndex(0);
    setAnswersByEntry({});
    setHintTexts([]);
    setHintMessage(null);
    setHintSource(null);
    setHintUsed(false);
    setWorking("");
    hintTokenRef.current += 1;
    setHintBusy(false);
    autoHintedRef.current = new Set();
    returnedRef.current = new Set();
    peekedRef.current = new Set();
    setLayerUi(null);
    setFullStage(false);
    setPhase("running");
  }, [plan]);

  const resetCardState = useCallback(() => {
    // WHY: A hint answer belongs to the card that asked. Bumping the token
    // makes every older response invisible, and clears its busy state here.
    hintTokenRef.current += 1;
    setHintBusy(false);
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
      playCue("finish");
      setPhase("done");
    },
    [exitFullScreen, loadPlan, plan, scopeDeck, scopePack],
  );

  const requestHint = useCallback(
    async (outcomeCategory?: string, automatic = false) => {
      if (!entry || hintBusy) return;
      const token = ++hintTokenRef.current;
      const requestedCard = entry.card.id;
      const requestedEntry = entry.entryId;
      const current = () =>
        token === hintTokenRef.current && entryIdRef.current === requestedEntry;
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
    [approved, entry, hintBusy, hintTexts, result],
  );

  const askHint = useCallback(() => {
    void requestHint();
  }, [requestHint]);

  const submitAnswer = useCallback(async () => {
    if (!entry || busy) return;
    setBusy(true);
    const submitted = entry;
    try {
      const response = await apiSend<AnswerResult>("/api/answer", "POST", {
        cardId: submitted.card.id,
        answers,
        timeMs: Date.now() - startedRef.current,
        hintUsed,
        // Help is teaching, not a hint: the layer never caps the outcome.
        helpSeen: layerOpen || peekedRef.current.has(submitted.entryId),
        coldCheck: submitted.coldCheck,
      });
      attemptsRef.current += 1;
      setResults((previous) => ({ ...previous, [submitted.entryId]: response }));
      const cue = cueForOutcome(response.cardOutcome);
      if (cue) playCue(cue);
      const reason = returnReason({
        level,
        peeked: peekedRef.current.has(submitted.entryId),
        wrong: isWrong(response.cardOutcome),
        alreadyReturned: returnedRef.current.has(submitted.card.id),
      });
      if (reason) {
        returnedRef.current.add(submitted.card.id);
        setQueue((previous) => [
          ...previous,
          {
            entryId: newId(),
            card: submitted.card,
            coldCheck: reason === "cold",
            suppressTeaching: reason === "cold",
            returnKind: reason,
          },
        ]);
      }
      // A tutor that is on should do something without being asked: one hint
      // after the first miss on this card, never a stream.
      if (
        shouldAutoHint({
          approved: approved === "yes",
          outcome: response.cardOutcome,
          alreadyAutoHinted: autoHintedRef.current.has(submitted.card.id),
        })
      ) {
        autoHintedRef.current.add(submitted.card.id);
        void requestHint(OUTCOME_LABELS[response.cardOutcome], true);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The answer could not be judged.");
    } finally {
      setBusy(false);
    }
  }, [answers, approved, busy, entry, hintUsed, layerOpen, level, requestHint]);

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
      if (!entry || !result) return;
      const row = result.rows.find((item) => item.region === region);
      if (!row) return;
      try {
        await apiSend("/api/evidence/correction", "POST", { rowId: row.id, outcome });
        setResults((previous) => {
          const current = previous[entry.entryId];
          if (!current) return previous;
          const nextResults = current.results.map((item) =>
            item.region === region ? { ...item, outcome } : item,
          );
          return {
            ...previous,
            [entry.entryId]: {
              ...current,
              results: nextResults,
              cardOutcome: worstOutcome(nextResults.map((item) => item.outcome)),
            },
          };
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The correction could not be saved.");
      }
    },
    [entry, result],
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
            <span className="finish-sparkle" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </span>
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

  if (phase === "running" && card && entry) {
    const cardPack = packs.find((pack) => pack.name === card.packName) ?? null;
    const instruction = studyCardInstruction(card, cardPack);
    const packLanguage = cardPack?.language;
    const layerBar =
      layerBarAvailable && !layerOpen ? (
        <div className="layer-bar">
          <span className="layer-bar-icon" aria-hidden="true">
            ▤
          </span>
          <div className="layer-bar-copy">
            <strong>Teaching layer</strong>
            <span>{layerBarText(level, Boolean(result))}</span>
          </div>
          <button className="btn small" type="button" onClick={openTeaching}>
            Show the teaching layer
          </button>
        </div>
      ) : null;
    const layer =
      layerOpen && card.teaching?.length ? (
        <TeachingLayer
          key={entry.entryId}
          parts={card.teaching}
          lang={packLanguage}
          level={level}
          answered={Boolean(result)}
          onCollapse={closeTeaching}
        />
      ) : null;

    return (
      <StudySession
        index={index}
        total={queue.length}
        fullStage={fullStage}
        busy={busy}
        stageRef={stageRef}
        onToggleFullScreen={() => (fullStage ? void exitFullScreen() : enterFullScreen())}
        onEnd={() => void finish(false, true)}
        aboveCard={layer}
      >
        {message ? <div className="notice error">{message}</div> : null}
        <StudyCard
          key={entry.entryId}
          card={card}
          answers={answers}
          onAnswerChange={updateAnswers}
          working={working}
          onWorkingChange={setWorking}
          result={result}
          hintTexts={hintTexts}
          hintMessage={hintMessage}
          hintSource={hintSource}
          hintBusy={hintBusy}
          busy={busy}
          returned={entry.returnKind === "wrong"}
          coldCheck={entry.coldCheck}
          layerBar={layerBar}
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
