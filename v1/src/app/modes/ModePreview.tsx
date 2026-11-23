"use client";

// WHY: A mode's example is the contract a generator copies. Showing it with the
// same card renderer as Study lets a learner check it without any write.
// PACK: mode-studio-ui
// 2026-11-23 opencode: created for Track 4 local preview. [pack: mode-studio-ui]

import { useEffect } from "react";
import type { LearningMode } from "@/lib/shared/types";
import { plainText } from "@/app/library/library-utils";
import { previewCardsFromExample } from "@/app/library/mode-studio-utils";
import CardSide from "@/app/study/CardSide";

interface ModePreviewProps {
  mode: LearningMode;
  onClose: () => void;
}

/** Local, read-only render of the canonical example. No route and no store. */
export default function ModePreview({ mode, onClose }: ModePreviewProps) {
  const cards = previewCardsFromExample(mode);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-wrap">
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Preview ${mode.name}`}>
        <div className="split-head">
          <h2 style={{ margin: 0 }}>Test preview: {mode.name}</h2>
          <span className="pill">local render, zero writes</span>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          {cards.length === 0 ? <p className="muted">This example has no cards yet.</p> : null}
          {cards.map((card, index) => (
            <div className="card tight" key={index}>
              <CardSide parts={card.prompt} revealAnswers={card.revealAnswers} />
              <div className="muted">Full line: {plainText(card.answer)}</div>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
