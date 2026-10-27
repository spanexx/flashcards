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

/** Speak text with the device voice, when the browser has one. */
export function speak(text: string, lang?: string): void {
  if (!speechSupported()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  if (lang) utterance.lang = lang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
