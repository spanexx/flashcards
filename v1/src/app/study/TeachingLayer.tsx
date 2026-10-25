// WHY: The teaching layer is the one part of the card that may open over the
// stage. It owns its own speech, so the session shell only decides when it is
// open and what closing returns to. It never blocks the answer: there is no
// backdrop, and there is always a way back to the question.
// PACK: teaching-layers
// 2026-10-25 opencode: moved out of the old StudyClient while merging the
// study-tab redesign; behaviour is unchanged. [pack: teaching-layers]

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TeachingMedia from "../TeachingMedia";
import { layerExplanation, layerSpeech } from "@/lib/client/layer";
import type { StudyLevel, TeachingPart } from "@/lib/shared/types";

/** Speech is checked after mount so the static build renders the same everywhere. */
function speechAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

/** Does this device name a voice for the language? An empty list is not a no. */
function hasVoice(lang: string): boolean {
  if (!lang) return true;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return true;
  const wanted = lang.toLowerCase().replace("_", "-");
  const primary = wanted.split("-")[0];
  return voices.some((voice) => {
    const heard = voice.lang.toLowerCase().replace("_", "-");
    return heard === wanted || heard.split("-")[0] === primary;
  });
}

interface TeachingLayerProps {
  parts: TeachingPart[];
  lang?: string;
  level: StudyLevel;
  answered: boolean;
  onCollapse: () => void;
}

/** The layer panel, above the card and never in front of the question. */
export default function TeachingLayer({
  parts,
  lang,
  level,
  answered,
  onCollapse,
}: TeachingLayerProps) {
  const lines = useMemo(() => layerSpeech(parts, lang), [parts, lang]);
  const [support, setSupport] = useState<"checking" | "ready" | "unavailable">("checking");
  const [speaking, setSpeaking] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const tokenRef = useRef(0);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setSupport(speechAvailable() ? "ready" : "unavailable");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      tokenRef.current += 1;
      if (speechAvailable()) window.speechSynthesis.cancel();
    },
    [],
  );

  const stop = useCallback(() => {
    tokenRef.current += 1;
    setSpeaking(false);
    if (speechAvailable()) window.speechSynthesis.cancel();
  }, []);

  const listen = useCallback(() => {
    if (!speechAvailable() || lines.length === 0) return;
    if (speaking) {
      stop();
      return;
    }
    tokenRef.current += 1;
    const token = tokenRef.current;
    setSpeaking(true);
    setMissing([]);
    window.speechSynthesis.cancel();
    const skipped = new Set<string>();
    const speakAt = (position: number) => {
      if (tokenRef.current !== token) return;
      if (position >= lines.length) {
        setSpeaking(false);
        if (skipped.size > 0) setMissing([...skipped]);
        return;
      }
      const line = lines[position];
      if (line.lang && !hasVoice(line.lang)) {
        skipped.add(line.lang);
        speakAt(position + 1);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(line.text);
      if (line.lang) utterance.lang = line.lang;
      utterance.onend = () => speakAt(position + 1);
      utterance.onerror = () => speakAt(position + 1);
      window.speechSynthesis.speak(utterance);
    };
    speakAt(0);
  }, [lines, speaking, stop]);

  return (
    <section className="layer-panel" role="dialog" aria-label="Teaching layer">
      <div className="layer-head">
        <div>
          <p className="muted small layer-kicker">Teaching layer · {level}</p>
          <h2>Teaching layer</h2>
          <p className="muted small">{layerExplanation(level, answered)}</p>
        </div>
        <button className="btn small" type="button" onClick={onCollapse} autoFocus>
          Collapse to the question
        </button>
      </div>
      <div className="layer-body">
        {parts.map((part, position) =>
          part.type === "text" ? (
            <p className="layer-text" key={position}>
              {part.text}
            </p>
          ) : (
            <TeachingMedia key={position} part={part} />
          ),
        )}
        {missing.length > 0 ? (
          <p className="muted small" role="status">
            No voice is installed for {missing.join(", ")}. Those lines were skipped.
          </p>
        ) : null}
      </div>
      {lines.length > 0 ? (
        <div className="layer-foot">
          <button
            className="btn primary"
            type="button"
            onClick={listen}
            disabled={support !== "ready"}
            aria-pressed={speaking}
          >
            {speaking ? "Stop" : "Listen to the layer"}
          </button>
          <p className="muted small">
            {support === "unavailable"
              ? "Speech is not available on this device."
              : support === "checking"
                ? "Checking the device voice..."
                : "Reads text parts only, top to bottom. Skips images and video. Uses the device voice."}
          </p>
        </div>
      ) : null}
    </section>
  );
}
