// WHY: Sound is optional delight, never a dependency. The cues are built from
// oscillators so nothing ships as an audio file, they stay off until the learner
// asks for them, and a missing or blocked audio engine is silent instead of an
// error.
// PACK: learner-delight
// 2026-10-25 opencode: created for the learner-delight pack [pack: learner-delight]
// 2026-10-28 opencode: a completion has its own short tick, separate from the
// judged outcome cue. [pack: study-card-guidance]

export type SoundCue = "got_it" | "nearly" | "missed" | "finish" | "complete";

export const SOUND_KEY = "flashcards.sound";

/** Fired after a same-tab change so the Settings switch reflects the write. */
export const SOUND_EVENT = "flashcards:sound";

export interface CueNote {
  /** Hz. */
  freq: number;
  /** Seconds after the cue begins. */
  start: number;
  /** Seconds the note sounds. */
  length: number;
  /** Peak gain, deliberately small. */
  gain: number;
}

const NOTES: Record<SoundCue, CueNote[]> = {
  // A rising pair: the answer landed.
  got_it: [
    { freq: 659.25, start: 0, length: 0.11, gain: 0.05 },
    { freq: 783.99, start: 0.085, length: 0.16, gain: 0.045 },
  ],
  // A short lift that does not pretend the answer was perfect.
  nearly: [
    { freq: 440, start: 0, length: 0.1, gain: 0.045 },
    { freq: 493.88, start: 0.09, length: 0.13, gain: 0.04 },
  ],
  // A soft fall, never a buzzer.
  missed: [
    { freq: 329.63, start: 0, length: 0.11, gain: 0.045 },
    { freq: 261.63, start: 0.1, length: 0.16, gain: 0.04 },
  ],
  // A gentle three-note close.
  finish: [
    { freq: 523.25, start: 0, length: 0.14, gain: 0.045 },
    { freq: 659.25, start: 0.12, length: 0.14, gain: 0.045 },
    { freq: 783.99, start: 0.24, length: 0.22, gain: 0.04 },
  ],
  // One soft tick: the rest of the line landed, not a verdict.
  complete: [{ freq: 587.33, start: 0, length: 0.06, gain: 0.03 }],
};

export function cueNotes(cue: SoundCue): CueNote[] {
  return NOTES[cue].map((note) => ({ ...note }));
}

/** The judged outcome, or null when a cue would say nothing useful. */
export function cueForOutcome(outcome: string): SoundCue | null {
  if (outcome === "got_it") return "got_it";
  if (outcome === "nearly") return "nearly";
  if (outcome === "again" || outcome === "no") return "missed";
  return null;
}

function safeStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Sound is on only when the learner turned it on. Anything else is off. */
export function isSoundOn(storage: Pick<Storage, "getItem"> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

export function setSoundOn(
  on: boolean,
  storage: Pick<Storage, "setItem"> | null = safeStorage(),
): void {
  try {
    storage?.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // A blocked store keeps the current page silent next time; nothing else.
  }
  // The switch updates even when storage refused the write.
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SOUND_EVENT));
}

/** The subscription the Settings switch needs, including another tab's write. */
export function subscribeSound(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SOUND_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SOUND_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

let context: AudioContext | null = null;

/** Built on the first user action, because browsers block audio before one. */
function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & { webkitAudioContext?: typeof AudioContext };
  const Ctor = window.AudioContext ?? host.webkitAudioContext;
  if (!Ctor) return null;
  try {
    if (!context) context = new Ctor();
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** Play one cue. `enabled` exists so a test can prove the silent path. */
export function playCue(cue: SoundCue, options: { enabled?: boolean } = {}): void {
  const enabled = options.enabled ?? isSoundOn();
  if (!enabled) return;
  const ctx = audioContext();
  if (!ctx) return;
  const base = ctx.currentTime + 0.02;
  for (const note of cueNotes(cue)) {
    try {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = cue === "missed" ? "sine" : "triangle";
      const at = base + note.start;
      oscillator.frequency.setValueAtTime(note.freq, at);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(note.gain, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + note.length);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + note.length + 0.02);
    } catch {
      // One note failing must not take the others or the session down.
    }
  }
}
