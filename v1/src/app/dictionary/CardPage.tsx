"use client";

// WHY: A card page is the long help behind one card, read one part at a time.
// The panel keeps one height, the dots show what is earned, and the page never
// blocks the card. Traces are the only thing this screen writes.
// PACK: course-dictionary
// 2026-10-29 qoder: created for the course dictionary pack. [pack: course-dictionary]

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import TeachingMedia, { type TeachingImagePart, type TeachingVideoPart } from "@/app/TeachingMedia";
import { PICTURE_SECONDS, VIDEO_TRACED_SHARE, pageTitle, tracedTextMs } from "@/lib/core/pages";
import type { Card, DictionaryPage, PageTrace, TeachingPart } from "@/lib/shared/types";

interface CardPageProps {
  page: DictionaryPage | null;
  trace: PageTrace | null;
  card: Card;
  packName: string;
  deckId?: string;
  deckName?: string;
  language?: string;
  onTraced: (index: number) => void;
  onEdit: () => void;
}

const EAR = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11 5L6 9H3v6h3l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

const CHEVRON_LEFT = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const CHEVRON_RIGHT = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const CHECK = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

function partKind(part: TeachingPart): string {
  if (part.type === "text") return "Text";
  if (part.type === "image") return "Picture";
  return "Video";
}

/** A video part reports its own playback; the trace lands at eighty percent. */
function StepVideo({ part, onWatched }: { part: TeachingVideoPart; onWatched: () => void }) {
  const watched = useCallback(
    (share: number) => {
      if (share >= VIDEO_TRACED_SHARE) onWatched();
    },
    [onWatched],
  );
  return <TeachingMedia part={part} onProgress={watched} />;
}

export default function CardPage({
  page,
  trace,
  card,
  packName,
  deckId,
  deckName,
  language,
  onTraced,
  onEdit,
}: CardPageProps) {
  const pageId = page?.id ?? "";
  const [step, setStep] = useState(0);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [canSpeak, setCanSpeak] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setStep(0);
      setFinished(false);
    });
    return () => {
      active = false;
    };
  }, [pageId]);

  useEffect(() => {
    const available =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined";
    Promise.resolve().then(() => setCanSpeak(available));
  }, []);

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(null);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    Promise.resolve().then(() => setSpeaking(null));
  }, [step, pageId]);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  useEffect(() => {
    if (zoom === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoom(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  const parts = page?.parts ?? [];
  const current = parts[step];
  const traced = new Set(trace?.traced ?? []);
  const currentTraced = traced.has(step);

  const traceCurrent = useCallback(() => {
    if (page) onTraced(step);
  }, [page, step, onTraced]);

  // WHY: A text part counts after its dwell, a picture after three seconds.
  // The timer stops the moment the part leaves the screen. [GRILL 21]
  useEffect(() => {
    if (!page || !current || currentTraced) return;
    let ms: number | null = null;
    if (current.type === "text") ms = tracedTextMs(current.text);
    else if (current.type === "image") ms = PICTURE_SECONDS * 1000;
    if (ms === null) return;
    const timer = setTimeout(traceCurrent, ms);
    return () => clearTimeout(timer);
  }, [page, current, currentTraced, traceCurrent]);

  const speak = (index: number, text: string, lang?: string) => {
    if (!canSpeak) return;
    if (speaking === index) {
      stopSpeech();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang) utterance.lang = lang;
    utterance.onend = () => {
      setSpeaking(null);
      if (index === step) onTraced(index);
    };
    utterance.onerror = () => setSpeaking(null);
    setSpeaking(index);
    window.speechSynthesis.speak(utterance);
  };

  const crumb = (
    <nav className="dict-crumb" aria-label="Breadcrumb">
      <Link href={`/dictionary?pack=${encodeURIComponent(packName)}`}>{packName}</Link>
      {deckId ? (
        <>
          <span aria-hidden="true">›</span>
          <Link href={`/dictionary?pack=${encodeURIComponent(packName)}&deck=${encodeURIComponent(deckId)}`}>
            {deckName ?? "Deck"}
          </Link>
        </>
      ) : null}
      <span aria-hidden="true">›</span>
      <span aria-current="page">{card.summary}</span>
    </nav>
  );

  if (!page || parts.length === 0) {
    return (
      <section>
        {crumb}
        <div className="split-head" style={{ marginTop: 8 }}>
          <div>
            <p className="eyebrow">Card page</p>
            <h1>{card.summary}</h1>
            <div className="row" style={{ marginTop: 6 }}>
              <span className="chip">Always open</span>
              {deckName ? <span className="chip">{deckName}</span> : null}
            </div>
          </div>
          <button className="btn small" type="button" onClick={onEdit}>
            Edit page
          </button>
        </div>
        <div className="empty" style={{ marginTop: 14 }}>
          <strong>Page not written.</strong> The card works without it. Add a few words, a
          picture or a video to explain the idea behind this card.
        </div>
      </section>
    );
  }

  return (
    <section>
      {crumb}

      <div className="split-head" style={{ marginTop: 8 }}>
        <div>
          <p className="eyebrow">Card page{deckName ? ` · ${deckName}` : ""}</p>
          <h1>{pageTitle(page, card.summary)}</h1>
          <div className="row" style={{ marginTop: 6 }}>
            <span className="chip good">Always open</span>
            <span className="chip">Not the card&apos;s question or answer</span>
            {page.learnerEdited ? <span className="chip accent">Your copy — private</span> : null}
          </div>
        </div>
        <button className="btn small" type="button" onClick={onEdit}>
          Edit page
        </button>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            The card page, one part at a time
          </p>
          <span className="chip">
            Step {step + 1} of {parts.length}
          </span>
        </div>

        <div className="dict-step">
          <div className="dict-step-body">
            <div className="dict-dots" aria-hidden="true">
              {parts.map((_, index) => (
                <span
                  key={index}
                  className={index === step ? "on" : traced.has(index) ? "traced" : ""}
                />
              ))}
            </div>
            <div className="dict-step-stack">
              {parts.map((part, index) => (
                <div
                  key={index}
                  className={`dict-step-part${index === step ? " on" : ""}`}
                  aria-hidden={index !== step}
                >
                  <div className="dict-part-head">
                    <span className="dict-part-kind">{partKind(part)}</span>
                    {part.type === "text" ? (
                      <button
                        className="dict-speak"
                        type="button"
                        aria-label={speaking === index ? "Stop reading" : "Listen to this part"}
                        aria-pressed={speaking === index}
                        disabled={!canSpeak}
                        title={canSpeak ? undefined : "This device has no voice to read with."}
                        onClick={() => speak(index, part.text, part.lang ?? language)}
                      >
                        {EAR}
                      </button>
                    ) : null}
                  </div>
                  {part.type === "text" ? (
                    <p className="dict-text">{part.text}</p>
                  ) : part.type === "image" ? (
                    <button
                      className="dict-zoom-open"
                      type="button"
                      aria-label="Enlarge the picture"
                      onClick={() => {
                        setZoom(index);
                        traceCurrent();
                      }}
                    >
                      <TeachingMedia part={part} />
                      <span className="dict-media-hint">Tap to enlarge</span>
                    </button>
                  ) : (
                    <StepVideo part={part} onWatched={traceCurrent} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="dict-step-nav">
            <button
              className="dict-arrow"
              type="button"
              aria-label="Previous part"
              disabled={step === 0}
              onClick={() => {
                setFinished(false);
                setStep((value) => Math.max(0, value - 1));
              }}
            >
              {CHEVRON_LEFT}
            </button>
            <button
              className="dict-arrow"
              type="button"
              aria-label={step === parts.length - 1 ? "Finish this card page" : "Next part"}
              onClick={() => {
                if (step < parts.length - 1) {
                  setFinished(false);
                  setStep((value) => value + 1);
                } else {
                  setFinished(true);
                }
              }}
            >
              {step === parts.length - 1 ? CHECK : CHEVRON_RIGHT}
            </button>
          </div>
        </div>

        <p className="muted small" style={{ margin: "10px 0 0" }} role="status">
          {finished
            ? "End of this card page. The next card has its own page."
            : currentTraced
              ? "This part is traced."
              : current?.type === "text"
                ? "Stay with the words, or use the speaker. The part counts once you have read it."
                : current?.type === "image"
                  ? "Look at the picture, or tap it to enlarge. Either way counts after a moment."
                  : "Play the video. The part counts at eighty percent."}
        </p>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <Link className="btn small" href={`/dictionary?pack=${encodeURIComponent(packName)}`}>
          Pack page ↑
        </Link>
        {deckId ? (
          <Link
            className="btn small"
            href={`/dictionary?pack=${encodeURIComponent(packName)}&deck=${encodeURIComponent(deckId)}`}
          >
            Deck page ↑
          </Link>
        ) : null}
      </div>

      {zoom !== null && parts[zoom]?.type === "image" ? (
        <div
          className="dict-zoom"
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged picture"
          onClick={(event) => {
            if (event.target === event.currentTarget) setZoom(null);
          }}
        >
          <div className="dict-zoom-body">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="chip">Tap outside or press Escape to close</span>
              <button className="btn small" type="button" onClick={() => setZoom(null)} autoFocus>
                Close
              </button>
            </div>
            <TeachingMedia part={parts[zoom] as TeachingImagePart} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
