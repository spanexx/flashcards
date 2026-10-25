// WHY: The running session is one shell around whatever card the learner is
// on: the position, the way out and the full-screen stage. The optional
// aboveCard element is the seam the teaching layer opens into (GRILL entries 3
// and 13); it renders nothing when no layer is supplied.
// PACK: study-tab-redesign
// 2026-10-25 opencode: replaced the session rail with the approved pips head
// [pack: study-tab-redesign]

import type { ReactNode, RefObject } from "react";
import { pipStates } from "@/lib/client/study-layout";

interface StudySessionProps {
  index: number;
  total: number;
  fullStage: boolean;
  busy: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
  onToggleFullScreen: () => void;
  onEnd: () => void;
  aboveCard?: ReactNode;
  children: ReactNode;
}

/** The head, the progress pips, the stage and the card. */
export default function StudySession({
  index,
  total,
  fullStage,
  busy,
  stageRef,
  onToggleFullScreen,
  onEnd,
  aboveCard,
  children,
}: StudySessionProps) {
  const pips = pipStates(index, total);
  return (
    <div ref={stageRef} className={`study-stage study-session${fullStage ? " stage-full" : ""}`}>
      <div className="study-stage-inner">
        <div className="study-session-head">
          <span className="study-count">
            Card {index + 1} of {total}
          </span>
          <div
            className="study-pips"
            role="progressbar"
            aria-label="Card progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={Math.min(index + 1, total)}
          >
            {pips.map((state, position) => (
              <span key={position} className={`study-pip ${state}`} aria-hidden="true" />
            ))}
          </div>
          <div className="study-head-actions">
            <button
              className="study-ghost"
              type="button"
              onClick={onToggleFullScreen}
              aria-pressed={fullStage}
            >
              {fullStage ? "Exit full screen" : "Full screen"}
            </button>
            <button
              className="study-ghost"
              type="button"
              onClick={onEnd}
              disabled={busy}
              aria-label="End the session"
            >
              End
            </button>
          </div>
        </div>
        {aboveCard}
        {children}
      </div>
    </div>
  );
}
