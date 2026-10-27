// WHY: A card with a speak part and, later, a teaching layer both use the
// device voice. One helper keeps the browser check and the cancel rule in one
// place, so neither screen grows its own copy.
// PACK: study-tab-redesign
// 2026-10-25 opencode: moved out of StudyClient for the Study redesign [pack: study-tab-redesign]

/** True only in a browser that can speak; false during server rendering. */
export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

/**
 * Speak lines in order, each in its own language, when the browser has a voice.
 * A line that cannot be spoken is skipped so one missing voice does not silence
 * the rest.
 */
export function speakLines(lines: readonly { text: string; lang: string }[]): void {
  if (!speechSupported() || lines.length === 0) return;
  window.speechSynthesis.cancel();
  const speakAt = (position: number) => {
    if (position >= lines.length) return;
    const line = lines[position];
    const utterance = new SpeechSynthesisUtterance(line.text);
    if (line.lang) utterance.lang = line.lang;
    utterance.onend = () => speakAt(position + 1);
    utterance.onerror = () => speakAt(position + 1);
    window.speechSynthesis.speak(utterance);
  };
  speakAt(0);
}

/** Speak one text with the device voice, when the browser has one. */
export function speak(text: string, lang?: string): void {
  speakLines([{ text, lang: lang ?? "" }]);
}
