"use client";

// WHY: Sound is a preference with a promise attached: off means off. The switch
// reads storage as an external source and starts off on the server, so the saved
// choice appears without a hydration mismatch and the write updates the label.
// PACK: learner-delight
// 2026-10-25 opencode: created for the learner-delight pack [pack: learner-delight]
// 2026-10-25 opencode: reads the saved choice through useSyncExternalStore.
// [pack: learner-delight]

import { useSyncExternalStore } from "react";
import { isSoundOn, setSoundOn, subscribeSound } from "@/lib/client/sound";

const SERVER_OFF = () => false;

export default function SoundSwitch() {
  const on = useSyncExternalStore(subscribeSound, isSoundOn, SERVER_OFF);

  return (
    <button
      className="switch"
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Sound effects"
      onClick={() => setSoundOn(!on)}
    >
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      <span className="switch-text">{on ? "On" : "Off"}</span>
    </button>
  );
}
