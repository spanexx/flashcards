// WHY: A card side is an ordered list of parts. The same renderer serves the
// question (with editable blanks), the answer (plain text and translations)
// and the reveal (the correct word in place of the blank). Keeping it in one
// module stops the two sides from drifting apart.
// PACK: study-tab-redesign
// 2026-10-25 opencode: moved from StudyClient for the Study redesign [pack: study-tab-redesign]

import { speak } from "@/lib/client/speech";
import type { CardPart } from "@/lib/shared/types";

/** Blanks keep the width the author asked for, even before they are typed in. */
function blankWidth(part: Extract<CardPart, { type: "blank" }>): string {
  if (part.width === "long") return "16ch";
  if (part.width === "medium") return "11ch";
  return "7ch";
}

interface CardSideProps {
  parts: CardPart[];
  answers?: Record<string, string>;
  onAnswer?: (id: string, value: string) => void;
  interactive?: boolean;
  /** When present, blanks render as the expected word instead of an input. */
  revealAnswers?: Record<string, string>;
}

/** Render one side of a card. */
export default function CardSide({
  parts,
  answers,
  onAnswer,
  interactive,
  revealAnswers,
}: CardSideProps) {
  return (
    <div className={interactive ? "prompt-text" : undefined}>
      {parts.map((part, index) => {
        if (part.type === "text") {
          // WHY: Pack parts arrive as separate strings; without a joining space
          // the answer reads "My jedliśmy obiad.We were eating dinner.".
          const next = parts[index + 1];
          const nextText = next?.type === "text" ? next.text : "";
          const needsSpace =
            index < parts.length - 1 &&
            !/\s$/.test(part.text) &&
            !/^[,.;:!?…]/.test(part.text) &&
            !/^[,.;:!?…]/.test(nextText);
          return (
            <span key={index}>
              {part.role === "translation" ? (
                <em className="study-translation">{part.text}</em>
              ) : (
                part.text
              )}
              {needsSpace ? " " : ""}
            </span>
          );
        }
        if (part.type === "code") {
          return (
            <pre className="code-block" key={index}>
              {part.text}
            </pre>
          );
        }
        if (part.type === "speak") {
          return (
            <span key={index}>
              <button type="button" className="btn small" onClick={() => speak(part.text, part.lang)}>
                Hear it
              </button>{" "}
              {part.label ? <span className="muted">{part.label}</span> : null}
            </span>
          );
        }
        if (part.type === "media") {
          return (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={index}
              src={part.src}
              alt={part.alt ?? ""}
              style={{ maxWidth: "100%", borderRadius: 8 }}
            />
          );
        }
        if (revealAnswers) {
          return (
            <span className="study-blank-revealed" key={part.id}>
              {revealAnswers[part.id] ?? ""}
            </span>
          );
        }
        return (
          <input
            key={part.id}
            className="blank-input"
            style={{ width: blankWidth(part) }}
            value={answers?.[part.id] ?? ""}
            placeholder={part.hint ?? ""}
            disabled={!interactive}
            onChange={(event) => onAnswer?.(part.id, event.target.value)}
            aria-label={part.hint ?? "Missing word"}
          />
        );
      })}
    </div>
  );
}
