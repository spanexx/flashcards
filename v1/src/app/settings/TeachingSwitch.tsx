"use client";

// WHY: Automatic opening is a preference with a visible promise: the switch
// must show the saved choice without a hydration mismatch, and pressing it must
// change the next card. It reads storage as an external source, exactly like
// the sound switch, and starts on for the server render (GRILL Q3, Q5).
// PACK: study-resilience
// 2026-10-26 qoder: created for the study-resilience pack [pack: study-resilience]

import { useSyncExternalStore } from "react";
import { readTeachingPrefs, subscribeTeaching, writeTeachingAutoOpen } from "@/lib/client/teaching";

const SERVER_DEFAULT = () => true;

function teachingAutoOpen(): boolean {
  return readTeachingPrefs().autoOpen;
}

export default function TeachingSwitch() {
  const autoOpen = useSyncExternalStore(subscribeTeaching, teachingAutoOpen, SERVER_DEFAULT);

  return (
    <button
      className="switch"
      type="button"
      role="switch"
      aria-checked={autoOpen}
      aria-label="Open the teaching layer automatically"
      onClick={() => writeTeachingAutoOpen(!autoOpen)}
    >
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      <span className="switch-text">{autoOpen ? "On" : "Off"}</span>
    </button>
  );
}
